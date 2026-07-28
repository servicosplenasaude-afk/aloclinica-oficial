/**
 * mercadopago-create-payment
 *
 * Cria pagamento avulso no Mercado Pago.
 *
 * Body (cliente envia):
 *   {
 *     amount: number,             // em reais (ex: 89.90)
 *     payment_method: "pix" | "boleto" | "credit_card" | "saved_card",
 *     // Identificadores de domínio (qual coisa estamos cobrando):
 *     reference_id: string,       // "appointment_<uuid>" | "queue_<uuid>" | "renewal_<uuid>" | "sub_<uuid>"
 *     description?: string,
 *
 *     // Para credit_card direto:
 *     card_token?: string,        // gerado client-side via Mercado Pago JS SDK
 *     installments?: number,      // default 1
 *     payment_method_id?: string, // "visa" | "master" | ... (necessário pra cartão)
 *
 *     // Para saved_card (vault):
 *     saved_card_id?: string,     // UUID da tabela saved_cards
 *
 *     // Para boleto:
 *     payer_doc?: { type: "CPF"|"CNPJ", number: string }
 *   }
 *
 * Retorna:
 *   PIX  → { payment_id, status, qr_code, qr_code_base64, ticket_url, expires_at }
 *   BOLETO → { payment_id, status, boleto_url, barcode, expires_at }
 *   CARD → { payment_id, status, message }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mpRequest, ensureMpCustomer, mpCorsHeaders, mapMpStatus } from "../_shared/mercadopago.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: mpCorsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const {
      // SECURITY: body.amount is IGNORED — the authoritative price is resolved
      // server-side from the referenced resource. Kept out of destructuring to
      // ensure it can never flow into the MP payload / DB.
      payment_method,
      reference_id,
      description,
      card_token,
      installments = 1,
      payment_method_id,
      saved_card_id,
      payer_doc,
      // SECURITY: cupom é REVALIDADO no servidor (resolveCouponPercent) — o % enviado
      // pelo cliente nunca é usado; só o código é aceito para relookup na tabela coupons.
      coupon_code,
    } = body;

    if (!payment_method) return jsonResponse({ error: "payment_method obrigatório" }, 400);
    if (!reference_id) return jsonResponse({ error: "reference_id obrigatório" }, 400);

    // SECURITY: resolve the authoritative amount server-side and verify the
    // caller OWNS the referenced resource. NEVER trust a client-supplied amount
    // (prevents "pay-what-you-want"). Throws AmountError → mapped to 400/403.
    let amount: number;
    try {
      amount = await resolveServerAmount(admin, reference_id, user.id, coupon_code);
    } catch (e) {
      const status = e instanceof AmountError ? e.status : 400;
      return jsonResponse({ error: (e as Error).message }, status);
    }

    // Busca profile pra montar payer
    const { data: profile } = await admin
      .from("profiles")
      .select("first_name, last_name, phone, cpf, mp_customer_id")
      .eq("user_id", user.id)
      .single();

    const payerEmail = user.email || "";
    const payerName = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : "";
    const payerDoc = payer_doc ?? (profile?.cpf ? { type: "CPF", number: profile.cpf.replace(/\D/g, "") } : null);

    if (!payerDoc) {
      return jsonResponse({ error: "CPF obrigatório — preencha seu cadastro antes de pagar" }, 400);
    }

    // Monta payload Mercado Pago
    const mpPayload: Record<string, any> = {
      transaction_amount: Number(amount),
      description: description || `AloClínica — ${reference_id}`,
      external_reference: reference_id,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      payer: {
        email: payerEmail,
        first_name: profile?.first_name || payerName.split(" ")[0] || "Cliente",
        last_name: profile?.last_name || payerName.split(" ").slice(1).join(" ") || "AloClínica",
        identification: payerDoc,
      },
    };

    // === PIX ===
    if (payment_method === "pix") {
      mpPayload.payment_method_id = "pix";
      mpPayload.date_of_expiration = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
    // === BOLETO ===
    else if (payment_method === "boleto") {
      mpPayload.payment_method_id = "bolbradesco";
      mpPayload.date_of_expiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      // Boleto exige endereço — usa um genérico se não houver
      mpPayload.payer.address = {
        zip_code: "01310-100",
        street_name: "Av. Paulista",
        street_number: "1000",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        federal_unit: "SP",
      };
    }
    // === CREDIT CARD (one-shot) ===
    else if (payment_method === "credit_card") {
      if (!card_token) return jsonResponse({ error: "card_token obrigatório para cartão" }, 400);
      mpPayload.token = card_token;
      mpPayload.installments = installments;
      if (payment_method_id) mpPayload.payment_method_id = payment_method_id;
    }
    // === SAVED CARD ===
    else if (payment_method === "saved_card") {
      if (!saved_card_id) return jsonResponse({ error: "saved_card_id obrigatório" }, 400);
      const { data: card } = await admin
        .from("saved_cards")
        .select("mp_card_id, mp_customer_id, brand, last4")
        .eq("id", saved_card_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();
      if (!card?.mp_card_id || !card.mp_customer_id) {
        return jsonResponse({ error: "Cartão salvo não encontrado ou inativo" }, 404);
      }
      // Cobrança via customer + card_id exige tokenizar o cartão salvo
      // Mercado Pago: POST /v1/card_tokens com {card_id, security_code?}
      // Pra recurring sem CVV, usar a opção customer_id+card_id direto em payment
      mpPayload.payer = { type: "customer", id: card.mp_customer_id };
      mpPayload.token = await tokenizeSavedCard(card.mp_card_id);
      mpPayload.installments = installments;
    } else {
      return jsonResponse({ error: `payment_method inválido: ${payment_method}` }, 400);
    }

    // Marketplace split: se o reference é uma consulta e o médico tem conta MP
    // conectada, o pagamento vai DIRETO para a conta dele e descontamos a fee
    // da plataforma. Caso contrário, mantém fluxo legado (recebemos 100%).
    let marketplaceAccessToken: string | undefined;
    if (reference_id.startsWith("appointment_")) {
      const apptId = reference_id.replace("appointment_", "");
      const { data: appt } = await admin.from("appointments")
        .select("doctor_id, price_at_booking")
        .eq("id", apptId).maybeSingle();
      if (appt?.doctor_id) {
        const { data: doc } = await admin.from("doctor_profiles")
          .select("mp_access_token, mp_user_id")
          .eq("id", appt.doctor_id).maybeSingle();
        if (doc?.mp_access_token && doc?.mp_user_id) {
          marketplaceAccessToken = doc.mp_access_token;
          // marketplace_fee é EM REAIS, a fatia da plataforma (10% padrão)
          const platformPercent = Number(Deno.env.get("PLATFORM_FEE_PERCENT") ?? 10);
          mpPayload.marketplace_fee = Math.round(Number(amount) * platformPercent) / 100;
          mpPayload.collector_id = Number(doc.mp_user_id);
        }
      }
    }

    // SECURITY: idempotency key is STABLE per (user, resource) — NOT time-bucketed.
    // A retry (same resource) reuses the same MP payment instead of double-charging.
    const idempotencyKey = `${user.id}-${reference_id}`;

    const mpRes = await mpRequest<any>("POST", "/v1/payments", mpPayload, {
      idempotencyKey,
      accessToken: marketplaceAccessToken,
    });

    if (!mpRes.ok) {
      // SECURITY: log the full MP response server-side but return only a
      // sanitized message to the client (no gateway internals / raw payload).
      console.error("[mercadopago-create-payment] MP payment failed", mpRes.status, mpRes.data);
      const errMessage = mpRes.data?.message || mpRes.data?.error || `Mercado Pago ${mpRes.status}`;
      const errCause = mpRes.data?.cause?.[0]?.description;
      return jsonResponse({
        error: errCause || errMessage,
        gateway_status: mpRes.status,
      }, 400);
    }

    const paymentId = String(mpRes.data.id);
    const mpStatus = mpRes.data.status as string;
    const internalStatus = mapMpStatus(mpStatus);

    // Persiste em payment_transactions
    const txPayload: Record<string, any> = {
      user_id: user.id,
      gateway: "mercadopago",
      mp_payment_id: paymentId,
      amount_cents: Math.round(Number(amount) * 100),
      currency: "BRL",
      payment_method: payment_method.toUpperCase(),
      status: internalStatus,
      // paid_at é usado pela janela de estorno de 24h do dono (mercadopago-refund).
      // Sem isso, um pagamento aprovado por cartão ficava com paid_at nulo e o
      // reembolso legítimo do paciente era bloqueado. PIX/boleto recebem paid_at
      // depois, via webhook, quando compensam.
      paid_at: internalStatus === "approved" ? new Date().toISOString() : null,
      resource_id: extractResourceId(reference_id),
      resource_type: extractResourceType(reference_id),
      raw_response: mpRes.data,
    };

    if (payment_method === "pix") {
      const poi = mpRes.data.point_of_interaction?.transaction_data;
      txPayload.mp_qr_code = poi?.qr_code ?? null;
      txPayload.mp_qr_code_base64 = poi?.qr_code_base64 ?? null;
    } else if (payment_method === "boleto") {
      txPayload.mp_boleto_url = mpRes.data.transaction_details?.external_resource_url ?? null;
    }

    // UPSERT idempotente: se cliente fizer retry, mp_payment_id é único — vira no-op
    await admin.from("payment_transactions").upsert(txPayload, { onConflict: "mp_payment_id" });

    // Atualiza appointment payment_status pra approved imediato em saved_card aprovado
    if (internalStatus === "approved" && reference_id.startsWith("appointment_")) {
      const apptId = reference_id.replace("appointment_", "");
      await admin
        .from("appointments")
        .update({ payment_status: "approved", payment_confirmed_at: new Date().toISOString() } as any)
        .eq("id", apptId);
    } else if (internalStatus === "approved" && reference_id.startsWith("package_")) {
      // Pacote: aprova a 1ª consulta E todas as recorrentes ligadas a ela.
      const firstId = reference_id.replace("package_", "");
      await admin
        .from("appointments")
        .update({ payment_status: "approved", payment_confirmed_at: new Date().toISOString() } as any)
        .or(`id.eq.${firstId},original_appointment_id.eq.${firstId}`);
    }

    // SECURITY (F1): consome o cupom de forma IDEMPOTENTE (uma vez por reference,
    // via coupon_usages). Fecha o buraco de "cupom nunca é gasto" — antes times_used
    // ficava parado e um cupom com limite virava ilimitado.
    if (coupon_code) {
      try {
        const pct = await resolveCouponPercent(admin, coupon_code);
        if (pct > 0) {
          const normalizedCoupon = String(coupon_code).trim().toUpperCase();
          const { error: usageErr } = await admin
            .from("coupon_usages")
            .insert({ coupon_code: normalizedCoupon, reference_id, user_id: user.id });
          if (!usageErr) {
            await admin.rpc("fn_increment_coupon_usage_atomic", { p_code: normalizedCoupon });
          }
        }
      } catch (e) {
        console.warn("[mercadopago-create-payment] coupon consume failed", e);
      }
    }

    // Monta resposta apropriada por método
    const result: Record<string, any> = {
      payment_id: paymentId,
      status: internalStatus,
      gateway_status: mpStatus,
    };

    if (payment_method === "pix") {
      const poi = mpRes.data.point_of_interaction?.transaction_data;
      result.qr_code = poi?.qr_code;
      result.qr_code_base64 = poi?.qr_code_base64;
      result.ticket_url = poi?.ticket_url;
      result.expires_at = mpRes.data.date_of_expiration;
    } else if (payment_method === "boleto") {
      result.boleto_url = mpRes.data.transaction_details?.external_resource_url;
      result.barcode = mpRes.data.barcode?.content;
      result.expires_at = mpRes.data.date_of_expiration;
    } else if (mpStatus === "rejected") {
      result.message = mpRes.data.status_detail || "Pagamento recusado";
    }

    return jsonResponse(result);
  } catch (e) {
    console.error("[mercadopago-create-payment] error:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});

async function tokenizeSavedCard(cardId: string): Promise<string> {
  // Tokeniza cartão salvo pra reuso (sem CVV)
  const tk = await mpRequest<{ id: string; error?: string }>(
    "POST",
    "/v1/card_tokens",
    { card_id: cardId }
  );
  if (!tk.ok || !tk.data.id) {
    throw new Error(`Falha ao tokenizar cartão salvo: ${tk.data.error || JSON.stringify(tk.data)}`);
  }
  return tk.data.id;
}

// Preço fixo da renovação de receita (em reais). NUNCA derivado de coluna
// escrita pelo cliente (prescription_renewals.price).
const RENEWAL_PRICE_BRL = 80;

// SECURITY: typed error so the handler can map ownership failures to 403 and
// resolution failures to 400.
class AmountError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * SECURITY: revalida um cupom no SERVIDOR e retorna o percentual de desconto
 * (0 se inválido/inativo/expirado/esgotado). O cliente só envia o CÓDIGO — o %
 * é sempre relido da tabela `coupons`. Resultado clampeado em 0..100.
 */
async function resolveCouponPercent(admin: any, code: unknown): Promise<number> {
  if (typeof code !== "string") return 0;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return 0;

  const { data, error } = await admin
    .from("coupons")
    .select("discount_percentage, max_uses, times_used, expires_at, is_active")
    .eq("code", normalized)
    .maybeSingle();

  if (error || !data) return 0;
  if (!data.is_active) return 0;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return 0;
  if (data.max_uses && Number(data.times_used) >= Number(data.max_uses)) return 0;

  const pct = Number(data.discount_percentage);
  if (!Number.isFinite(pct)) return 0;
  return Math.min(Math.max(pct, 0), 100);
}

/**
 * SECURITY: resolves the AUTHORITATIVE charge amount (in reais) for a
 * reference_id, reading the resource with the service-role client and
 * verifying the caller OWNS it. The client-supplied amount is never used.
 *
 * Prefixes:
 *   appointment_<uuid> → doctor_profiles.consultation_price (fonte do médico) − cupom
 *                        (owner: patient_id — paciente NÃO escreve o preço-base)
 *   queue_<uuid>       → on_demand_queue.price          (owner: patient_id)
 *   renewal_<uuid>     → RENEWAL_PRICE_BRL fixo          (owner: patient_id)
 *   sub_<uuid>         → plan price via subscriptions/pingo_card_subscriptions
 *                        (owner: user_id)
 */
async function resolveServerAmount(admin: any, referenceId: string, callerId: string, couponCode?: string): Promise<number> {
  const idx = referenceId.indexOf("_");
  const prefix = idx === -1 ? "" : referenceId.slice(0, idx);
  const resourceId = idx === -1 ? "" : referenceId.slice(idx + 1);
  if (!resourceId) throw new AmountError(`reference_id inválido: ${referenceId}`, 400);

  const requireOwner = (ownerId: string | null | undefined) => {
    if (!ownerId || ownerId !== callerId) {
      throw new AmountError("Sem permissão para pagar este recurso", 403);
    }
  };
  const requirePrice = (price: unknown): number => {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) {
      throw new AmountError("Não foi possível determinar o valor a cobrar", 400);
    }
    return n;
  };

  if (prefix === "appointment") {
    const { data, error } = await admin
      .from("appointments")
      .select("patient_id, doctor_id")
      .eq("id", resourceId)
      .maybeSingle();
    if (error || !data) throw new AmountError("Consulta não encontrada", 404);
    requireOwner(data.patient_id);
    // SECURITY: o preço-base vem da FONTE DO MÉDICO (doctor_profiles.price), que o
    // paciente NÃO consegue escrever — jamais de appointments.price_at_booking
    // (coluna gravada pelo cliente). Isso fecha o subfaturamento ("pague R$1").
    const { data: doc, error: docErr } = await admin
      .from("doctor_profiles")
      .select("price")
      .eq("id", data.doctor_id)
      .maybeSingle();
    if (docErr || !doc) throw new AmountError("Médico não encontrado", 404);
    const base = Number(doc.price);
    // Retorno: 50% de desconto quando o paciente tem consulta CONCLUÍDA com este
    // médico cujo prazo de retorno ainda é válido (mesma regra do BookAppointment).
    // Aplicado no SERVIDOR para a cobrança NUNCA ser maior que a exibida ao paciente.
    let returnFactor = 1;
    const { data: priorReturn } = await admin
      .from("appointments")
      .select("id")
      .eq("patient_id", data.patient_id)
      .eq("doctor_id", data.doctor_id)
      .eq("status", "completed")
      .not("return_deadline", "is", null)
      .gte("return_deadline", new Date().toISOString())
      .neq("id", resourceId)
      .limit(1);
    if (priorReturn && priorReturn.length > 0) returnFactor = 0.5;
    // Descontos: retorno (servidor) + cupom (revalidado no servidor).
    const pct = await resolveCouponPercent(admin, couponCode);
    const final = Math.round(base * returnFactor * (1 - pct / 100) * 100) / 100;
    return requirePrice(final);
  }

  if (prefix === "package") {
    // Pacote de agendamento recorrente: a 1ª consulta (id = resourceId) + as
    // recorrentes ligadas a ela (original_appointment_id = resourceId). Cobra N×preço
    // do médico numa vez só; ao aprovar, TODAS ficam approved (evita o bug antigo de
    // "cria N, cobra 1, cancela N-1"). Preço-base SEMPRE da fonte do médico.
    const { data: first, error } = await admin
      .from("appointments")
      .select("patient_id, doctor_id")
      .eq("id", resourceId)
      .maybeSingle();
    if (error || !first) throw new AmountError("Pacote não encontrado", 404);
    requireOwner(first.patient_id);
    const { count } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", first.patient_id)
      .or(`id.eq.${resourceId},original_appointment_id.eq.${resourceId}`)
      .neq("status", "cancelled");
    const n = Math.max(1, count ?? 1);
    const { data: doc, error: docErr } = await admin
      .from("doctor_profiles")
      .select("price")
      .eq("id", first.doctor_id)
      .maybeSingle();
    if (docErr || !doc) throw new AmountError("Médico não encontrado", 404);
    const base = Number(doc.price);
    // Pacotes são consultas de 1ª vez (sem desconto de retorno); cupom aplica ao total.
    const pct = await resolveCouponPercent(admin, couponCode);
    const final = Math.round(n * base * (1 - pct / 100) * 100) / 100;
    return requirePrice(final);
  }

  if (prefix === "queue") {
    const { data, error } = await admin
      .from("on_demand_queue")
      .select("patient_id, price")
      .eq("id", resourceId)
      .maybeSingle();
    if (error || !data) throw new AmountError("Item da fila não encontrado", 404);
    requireOwner(data.patient_id);
    // TODO: derivar do calculate-shift-price no servidor
    return requirePrice(data.price);
  }

  if (prefix === "renewal") {
    const { data, error } = await admin
      .from("prescription_renewals")
      .select("patient_id")
      .eq("id", resourceId)
      .maybeSingle();
    if (error || !data) throw new AmountError("Renovação não encontrada", 404);
    requireOwner(data.patient_id);
    // Preço fixo definido pela plataforma — não lê a coluna .price (client-writable).
    return requirePrice(RENEWAL_PRICE_BRL);
  }

  if (prefix === "sub") {
    // Try the generic subscriptions table first (plan price), then pingo_card.
    const { data: sub } = await admin
      .from("subscriptions")
      .select("user_id, plan_id")
      .eq("id", resourceId)
      .maybeSingle();
    if (sub) {
      requireOwner(sub.user_id);
      const { data: plan } = await admin
        .from("plans")
        .select("price")
        .eq("id", sub.plan_id)
        .maybeSingle();
      return requirePrice(plan?.price);
    }
    const { data: pcSub } = await admin
      .from("pingo_card_subscriptions")
      .select("user_id, plan_id, billing_cycle")
      .eq("id", resourceId)
      .maybeSingle();
    if (pcSub) {
      requireOwner(pcSub.user_id);
      const { data: pcPlan } = await admin
        .from("pingo_card_plans")
        .select("price_monthly, price_yearly")
        .eq("id", pcSub.plan_id)
        .maybeSingle();
      const price = pcSub.billing_cycle === "yearly" ? pcPlan?.price_yearly : pcPlan?.price_monthly;
      return requirePrice(price);
    }
    throw new AmountError("Assinatura não encontrada", 404);
  }

  throw new AmountError(`Tipo de referência desconhecido: ${referenceId}`, 400);
}

function extractResourceId(reference: string): string {
  // "appointment_uuid" → "uuid"
  const idx = reference.indexOf("_");
  return idx === -1 ? reference : reference.slice(idx + 1);
}

function extractResourceType(reference: string): string {
  if (reference.startsWith("appointment_")) return "appointment";
  if (reference.startsWith("package_")) return "appointment";
  if (reference.startsWith("queue_")) return "urgent_queue";
  if (reference.startsWith("renewal_")) return "prescription_renewal";
  if (reference.startsWith("sub_")) return "subscription";
  return "other";
}

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...mpCorsHeaders, "Content-Type": "application/json" },
  });
}
