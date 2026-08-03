// ============================================================================
// pagbank-charge-card — cobra uma consulta no CARTÃO via PagBank.
// FUNDAÇÃO (sandbox). O cartão chega CIFRADO do frontend (encrypted) — nunca em
// texto puro no servidor. Valor SEMPRE resolvido no servidor; exige o paciente
// dono da consulta. Payload validado no sandbox (charge status = PAID).
// ============================================================================
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCaller } from "../_shared/auth.ts";
import { pagbankConfigured, pagbankCreateOrder } from "../_shared/pagbank.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (!pagbankConfigured()) return json({ error: "PagBank não configurado (PAGBANK_TOKEN)." }, 503);

    const caller = await getCaller(req);
    if (!caller.user) return json({ error: "não autenticado" }, 401);

    const { appointment_id, encrypted_card, installments } = await req.json();
    if (!appointment_id || !encrypted_card) {
      return json({ error: "appointment_id e encrypted_card são obrigatórios" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: appt } = await svc
      .from("appointments").select("id, patient_id, price_at_booking").eq("id", appointment_id).single();
    if (!appt) return json({ error: "consulta não encontrada" }, 404);
    if (appt.patient_id !== caller.user.id) return json({ error: "acesso negado" }, 403);

    const valueCents = Math.round(Number(appt.price_at_booking ?? 0) * 100);
    if (!(valueCents > 0)) return json({ error: "valor inválido para esta consulta" }, 400);

    const { data: profile } = await svc
      .from("profiles").select("first_name, last_name, cpf").eq("user_id", appt.patient_id).single();
    const { data: authUser } = await svc.auth.admin.getUserById(appt.patient_id);
    const email = authUser?.user?.email ?? "";

    const order = {
      reference_id: appt.id,
      customer: {
        name: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Paciente",
        email: email || undefined,
        tax_id: (profile?.cpf ?? "").replace(/\D/g, "") || undefined,
      },
      items: [{ name: "Teleconsulta", quantity: 1, unit_amount: valueCents }],
      charges: [{
        reference_id: appt.id,
        description: "Teleconsulta",
        amount: { value: valueCents, currency: "BRL" },
        payment_method: {
          type: "CREDIT_CARD",
          installments: Math.max(1, Math.min(12, Number(installments) || 1)),
          capture: true,
          card: { encrypted: encrypted_card },
        },
      }],
      notification_urls: [`${supabaseUrl}/functions/v1/pagbank-webhook`],
    };

    const { ok, status, data } = await pagbankCreateOrder(order);
    const charge = (data.charges as Array<Record<string, unknown>> | undefined)?.[0];
    const chargeStatus = String(charge?.status ?? "");
    const paid = ["PAID", "AUTHORIZED"].includes(chargeStatus);

    if (paid) {
      await svc
        .from("appointments")
        .update({ payment_status: "approved", payment_confirmed_at: new Date().toISOString() })
        .eq("id", appt.id);
      // Confirmação idempotente (mesma função do MP/PIX).
      try {
        await fetch(`${supabaseUrl}/functions/v1/appointment-confirmed`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            "x-internal-secret": Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "",
          },
          body: JSON.stringify({ appointment_id: appt.id }),
        });
      } catch (e) {
        console.error("[pagbank-charge-card] falha ao disparar confirmação:", e);
      }
    }

    if (!ok && !charge) {
      return json({ error: "falha ao cobrar no cartão", details: data }, status);
    }
    return json({ success: paid, status: chargeStatus, paid, order_id: data.id });
  } catch (e) {
    console.error("[pagbank-charge-card] erro:", e);
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});
