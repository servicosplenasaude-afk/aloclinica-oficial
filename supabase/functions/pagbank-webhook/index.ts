// ============================================================================
// pagbank-webhook — recebe as notificações do PagBank (server-to-server).
// FUNDAÇÃO (sandbox). Autenticado pela assinatura x-authenticity-token.
//
// Fluxo: valida assinatura → extrai reference_id (= appointment_id) + status →
// se PAGO, marca a consulta como paga e dispara a confirmação idempotente
// (mesma função usada pelo Mercado Pago: appointment-confirmed).
// ============================================================================
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pagbankVerifyWebhook } from "../_shared/pagbank.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-authenticity-token",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    // Corpo BRUTO (a assinatura é sobre o texto exato recebido).
    const raw = await req.text();
    const valid = await pagbankVerifyWebhook(raw, req.headers.get("x-authenticity-token"));
    if (!valid) {
      console.warn("[pagbank-webhook] assinatura inválida");
      return json({ error: "assinatura inválida" }, 401);
    }

    const body = JSON.parse(raw) as Record<string, any>;
    const referenceId: string | undefined = body?.reference_id;
    // A notificação pode vir como order (com charges/qr_codes) — pega o status.
    const charge = Array.isArray(body?.charges) ? body.charges[0] : undefined;
    const qr = Array.isArray(body?.qr_codes) ? body.qr_codes[0] : undefined;
    const status: string | undefined = charge?.status ?? qr?.status ?? body?.status;

    if (!referenceId || !status) {
      // Nada acionável — mas responde 200 pra o PagBank não reentregar em loop.
      return json({ received: true, note: "sem reference_id/status acionável" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const isPaid = ["PAID", "AVAILABLE", "APPROVED"].includes(String(status).toUpperCase());

    if (isPaid) {
      await svc
        .from("appointments")
        .update({ payment_status: "approved", payment_confirmed_at: new Date().toISOString() })
        .eq("id", referenceId);

      // Dispara a confirmação idempotente (e-mail/WhatsApp/in-app) — mesma função do MP.
      try {
        await fetch(`${supabaseUrl}/functions/v1/appointment-confirmed`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            "x-internal-secret": Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "",
          },
          body: JSON.stringify({ appointment_id: referenceId }),
        });
      } catch (e) {
        console.error("[pagbank-webhook] falha ao disparar appointment-confirmed:", e);
      }
    }

    return json({ received: true, status });
  } catch (e) {
    console.error("[pagbank-webhook] erro:", e);
    // 200 mesmo em erro de parse pra evitar reentrega infinita; log fica registrado.
    return json({ received: true, error: e instanceof Error ? e.message : "erro" });
  }
});
