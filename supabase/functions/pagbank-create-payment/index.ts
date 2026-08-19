// ============================================================================
// pagbank-create-payment — cria uma cobrança PIX no PagBank para uma consulta.
// FUNDAÇÃO (sandbox). Ainda NÃO é chamada pelo app — o Mercado Pago segue ativo.
//
// Segurança (mesmo padrão do hardening do MP):
//  - exige paciente autenticado E dono da consulta;
//  - valor SEMPRE resolvido no servidor (nunca confia no cliente);
//  - registra a intenção de pagamento; o webhook confirma.
// ============================================================================
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCaller } from "../_shared/auth.ts";
import { pagbankConfigured, pagbankCreateOrder, pagbankSplit } from "../_shared/pagbank.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (!pagbankConfigured()) {
      return json({ error: "PagBank não configurado (defina o secret PAGBANK_TOKEN)." }, 503);
    }

    const caller = await getCaller(req);
    if (!caller.user) return json({ error: "não autenticado" }, 401);

    const { appointment_id } = await req.json();
    if (!appointment_id) return json({ error: "appointment_id obrigatório" }, 400);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: appt } = await svc
      .from("appointments")
      .select("id, patient_id, doctor_id, price_at_booking, payment_status")
      .eq("id", appointment_id)
      .single();
    if (!appt) return json({ error: "consulta não encontrada" }, 404);

    // SEGURANÇA: só o paciente dono cria o pagamento da própria consulta.
    if (appt.patient_id !== caller.user.id) return json({ error: "acesso negado" }, 403);

    // Valor autoritativo do servidor (em centavos). Nunca do cliente.
    const valueCents = Math.round(Number(appt.price_at_booking ?? 0) * 100);
    if (!(valueCents > 0)) return json({ error: "valor inválido para esta consulta" }, 400);

    const durableReference = `pagbank:pix:${appt.id}`;
    const { data: existing } = await svc.from("payment_transactions").select("*")
      .eq("pagbank_reference_id", durableReference).maybeSingle();
    if (existing?.pagbank_order_id) {
      const savedQr = (existing.raw_response as any)?.qr_codes?.[0];
      const savedLinks = savedQr?.links ?? [];
      return json({ success: true, idempotent: true, order_id: existing.pagbank_order_id,
        pix_copy_paste: savedQr?.text ?? null,
        pix_qr_image: savedLinks.find((l: any) => l.media === "image/png")?.href ?? null,
        expires_at: savedQr?.expiration_date ?? null });
    }
    const { error: intentError } = await svc.from("payment_transactions").insert({
      user_id: appt.patient_id, gateway: "pagbank", payment_method: "pix",
      amount_cents: valueCents, currency: "BRL", status: "creating",
      resource_id: appt.id, resource_type: "appointment", pagbank_reference_id: durableReference,
    } as any);
    if (intentError) return json({ error: "pagamento ja esta sendo criado" }, 409);

    // Dados do pagador
    const { data: profile } = await svc
      .from("profiles").select("first_name, last_name, cpf").eq("user_id", appt.patient_id).single();
    const { data: authUser } = await svc.auth.admin.getUserById(appt.patient_id);
    const email = authUser?.user?.email ?? "";

    const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pagbank-webhook`;

    // Split (repasse ao médico) — só se o médico tiver conta PagBank vinculada
    // e a conta da plataforma estiver configurada. Senão, sem split.
    const { data: doc } = await svc
      .from("doctor_profiles").select("pagbank_account_id").eq("id", appt.doctor_id).single();
    const split = pagbankSplit(valueCents, (doc as { pagbank_account_id?: string } | null)?.pagbank_account_id);

    const order = {
      reference_id: appt.id,
      customer: {
        name: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Paciente",
        email: email || undefined,
        tax_id: (profile?.cpf ?? "").replace(/\D/g, "") || undefined,
      },
      items: [{ name: "Teleconsulta", quantity: 1, unit_amount: valueCents }],
      qr_codes: [{ amount: { value: valueCents } }],
      notification_urls: [notifyUrl],
      ...(split ? { splits: split } : {}),
    };

    const { ok, status, data } = await pagbankCreateOrder(order);
    if (!ok) {
      await svc.from("payment_transactions").update({ status: "failed", raw_response: data } as any)
        .eq("pagbank_reference_id", durableReference);
      console.error("[pagbank-create-payment] falha:", status, JSON.stringify(data));
      return json({ error: "falha ao criar cobrança no PagBank", details: data }, status);
    }

    const qr = (data.qr_codes as Array<Record<string, unknown>> | undefined)?.[0];
    const links = (qr?.links as Array<{ media?: string; href?: string }> | undefined) ?? [];
    const { error: persistError } = await svc.from("payment_transactions").update({
      pagbank_order_id: String(data.id ?? ""), status: "pending", raw_response: data,
    } as any).eq("pagbank_reference_id", durableReference);
    if (persistError) return json({ error: "cobranca criada mas nao conciliada" }, 503);

    return json({
      success: true,
      order_id: data.id,
      pix_copy_paste: qr?.text ?? null,
      pix_qr_image: links.find((l) => l.media === "image/png")?.href ?? null,
      expires_at: qr?.expiration_date ?? null,
    });
  } catch (e) {
    console.error("[pagbank-create-payment] erro:", e);
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});
