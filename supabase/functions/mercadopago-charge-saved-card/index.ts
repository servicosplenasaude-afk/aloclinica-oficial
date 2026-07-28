/**
 * mercadopago-charge-saved-card
 *
 * Cobra um cartão salvo no vault MP. Usado por:
 *   - Cron diário de assinaturas recorrentes (legacy path; preferir preapproval)
 *   - Checkout com cartão salvo escolhido
 *
 * Body:
 *   {
 *     saved_card_id: string,    // UUID em saved_cards
 *     amount: number,           // reais
 *     reference_id: string,
 *     description?: string,
 *     security_code?: string,   // opcional — exigido em algumas categorias
 *     installments?: number
 *   }
 *
 * Diferença pra create-payment(saved_card): este endpoint pode ser chamado
 * por service-role (cron) sem usuário autenticado, passando user_id no body.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mpRequest, mpCorsHeaders, mapMpStatus } from "../_shared/mercadopago.ts";
import { getCaller } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: mpCorsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // SECURITY: require a valid user JWT. This endpoint charges a saved card, so
    // it must NOT be callable unauthenticated. The caller's own id is the only
    // trusted identity — any body `user_id` is ignored.
    const caller = await getCaller(req);
    if (!caller.user) return json({ error: "Unauthorized" }, 401);
    const userId = caller.user.id;

    const body = await req.json();
    const {
      saved_card_id,
      // SECURITY: body.amount is IGNORED — resolved server-side from the resource.
      reference_id,
      description,
      security_code,
      installments = 1,
      // SECURITY: cupom REVALIDADO no servidor — só o código é aceito, o % é relido.
      coupon_code,
    } = body;

    if (!saved_card_id) return json({ error: "saved_card_id obrigatório" }, 400);
    if (!reference_id) return json({ error: "reference_id obrigatório" }, 400);

    // SECURITY: derive the authoritative amount server-side and verify the caller
    // OWNS the referenced resource. Never trust a client-supplied amount.
    let amount: number;
    try {
      amount = await resolveServerAmount(admin, reference_id, userId, coupon_code);
    } catch (e) {
      const status = e instanceof AmountError ? e.status : 400;
      return json({ error: (e as Error).message }, status);
    }

    // Busca cartão
    const { data: card } = await admin
      .from("saved_cards")
      .select("mp_card_id, mp_customer_id, brand, last4")
      .eq("id", saved_card_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!card?.mp_card_id || !card.mp_customer_id) {
      return json({ error: "Cartão não encontrado ou inativo" }, 404);
    }

    // Tokeniza o cartão salvo (necessário pra cobrar)
    const tokenPayload: Record<string, any> = { card_id: card.mp_card_id };
    if (security_code) tokenPayload.security_code = security_code;

    const tk = await mpRequest<{ id: string; error?: string; message?: string }>(
      "POST",
      "/v1/card_tokens",
      tokenPayload
    );
    if (!tk.ok || !tk.data.id) {
      return json({ error: tk.data?.message || "Falha ao tokenizar cartão salvo", gateway: tk.data }, 400);
    }

    // Busca payer info
    const { data: profile } = await admin
      .from("profiles")
      .select("first_name, last_name, cpf")
      .eq("user_id", userId)
      .single();
    const { data: { user: userInfo } } = await admin.auth.admin.getUserById(userId);

    const payment = await mpRequest<any>(
      "POST",
      "/v1/payments",
      {
        transaction_amount: Number(amount),
        token: tk.data.id,
        installments,
        description: description || `AloClínica — ${reference_id}`,
        external_reference: reference_id,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
        payer: {
          type: "customer",
          id: card.mp_customer_id,
          email: userInfo?.email,
          identification: profile?.cpf ? { type: "CPF", number: profile.cpf.replace(/\D/g, "") } : undefined,
        },
      },
      // SECURITY: stable idempotency key per (user, resource) — not time-bucketed —
      // so a retry reuses the same MP payment instead of double-charging.
      { idempotencyKey: `${userId}-${reference_id}` }
    );

    if (!payment.ok) {
      return json({
        error: payment.data?.message || payment.data?.cause?.[0]?.description || "Falha na cobrança",
        gateway: payment.data,
      }, 400);
    }

    const status = mapMpStatus(payment.data.status);

    // Persiste transação
    await admin.from("payment_transactions").upsert({
      user_id: userId,
      gateway: "mercadopago",
      mp_payment_id: String(payment.data.id),
      amount_cents: Math.round(Number(amount) * 100),
      currency: "BRL",
      payment_method: "SAVED_CARD",
      status,
      saved_card_id,
      resource_id: extractResourceId(reference_id),
      resource_type: extractResourceType(reference_id),
      paid_at: status === "approved" ? new Date().toISOString() : null,
      raw_response: payment.data,
    } as any, { onConflict: "mp_payment_id" });

    return json({
      payment_id: String(payment.data.id),
      status,
      gateway_status: payment.data.status,
      message: status === "refused" ? (payment.data.status_detail || "Recusado") : undefined,
    });
  } catch (e) {
    console.error("[mp-charge-saved-card] error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

// Preço fixo da renovação de receita (em reais) — nunca de coluna client-writable.
const RENEWAL_PRICE_BRL = 80;

// SECURITY: typed error to map ownership → 403 and resolution failures → 400.
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
 * SECURITY: resolves the AUTHORITATIVE charge amount (reais) for a reference_id,
 * reading the resource with the service-role client and verifying the caller
 * OWNS it. Client-supplied amounts are never used. Base da consulta vem de
 * doctor_profiles.consultation_price (fonte do médico), não de price_at_booking.
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
      .from("appointments").select("patient_id, doctor_id").eq("id", resourceId).maybeSingle();
    if (error || !data) throw new AmountError("Consulta não encontrada", 404);
    requireOwner(data.patient_id);
    // SECURITY: base = fonte do médico (doctor_profiles.price), jamais
    // price_at_booking (client-writable). Fecha o subfaturamento.
    const { data: doc, error: docErr } = await admin
      .from("doctor_profiles").select("price").eq("id", data.doctor_id).maybeSingle();
    if (docErr || !doc) throw new AmountError("Médico não encontrado", 404);
    const base = Number(doc.price);
    // Retorno: 50% quando há consulta CONCLUÍDA com este médico dentro do prazo de
    // retorno (mesma regra do create-payment/BookAppointment). Assim o pagamento com
    // cartão salvo também respeita o desconto — cobrança nunca maior que a exibida.
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
    const pct = await resolveCouponPercent(admin, couponCode);
    const final = Math.round(base * returnFactor * (1 - pct / 100) * 100) / 100;
    return requirePrice(final);
  }
  if (prefix === "queue") {
    const { data, error } = await admin
      .from("on_demand_queue").select("patient_id, price").eq("id", resourceId).maybeSingle();
    if (error || !data) throw new AmountError("Item da fila não encontrado", 404);
    requireOwner(data.patient_id);
    // TODO: derivar do calculate-shift-price no servidor
    return requirePrice(data.price);
  }
  if (prefix === "renewal") {
    const { data, error } = await admin
      .from("prescription_renewals").select("patient_id").eq("id", resourceId).maybeSingle();
    if (error || !data) throw new AmountError("Renovação não encontrada", 404);
    requireOwner(data.patient_id);
    // Preço fixo da plataforma — não lê a coluna .price (client-writable).
    return requirePrice(RENEWAL_PRICE_BRL);
  }
  if (prefix === "sub") {
    const { data: sub } = await admin
      .from("subscriptions").select("user_id, plan_id").eq("id", resourceId).maybeSingle();
    if (sub) {
      requireOwner(sub.user_id);
      const { data: plan } = await admin.from("plans").select("price").eq("id", sub.plan_id).maybeSingle();
      return requirePrice(plan?.price);
    }
    const { data: pcSub } = await admin
      .from("pingo_card_subscriptions").select("user_id, plan_id, billing_cycle").eq("id", resourceId).maybeSingle();
    if (pcSub) {
      requireOwner(pcSub.user_id);
      const { data: pcPlan } = await admin
        .from("pingo_card_plans").select("price_monthly, price_yearly").eq("id", pcSub.plan_id).maybeSingle();
      const price = pcSub.billing_cycle === "yearly" ? pcPlan?.price_yearly : pcPlan?.price_monthly;
      return requirePrice(price);
    }
    throw new AmountError("Assinatura não encontrada", 404);
  }
  throw new AmountError(`Tipo de referência desconhecido: ${referenceId}`, 400);
}

function extractResourceId(reference: string): string {
  const idx = reference.indexOf("_");
  return idx === -1 ? reference : reference.slice(idx + 1);
}
function extractResourceType(reference: string): string {
  if (reference.startsWith("appointment_")) return "appointment";
  if (reference.startsWith("queue_")) return "urgent_queue";
  if (reference.startsWith("renewal_")) return "prescription_renewal";
  if (reference.startsWith("sub_")) return "subscription";
  return "other";
}
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...mpCorsHeaders, "Content-Type": "application/json" },
  });
}
