import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getCaller } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller.user || !caller.isAdmin) return json({ error: "Unauthorized" }, 401);
  if (!(await checkRateLimit(caller.user.id, "admin-confirm-payout", 30, 5, true))) {
    return json({ error: "Too many requests" }, 429);
  }

  const body = await req.json().catch(() => ({}));
  const payoutId = typeof body.payout_id === "string" ? body.payout_id.trim() : "";
  const transactionId = typeof body.transaction_id === "string" ? body.transaction_id.trim() : "";
  const confirmationSource = body.confirmation_source;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payoutId)) {
    return json({ error: "payout_id inválido" }, 400);
  }
  if (transactionId.length < 6 || transactionId.length > 160 || !/^[A-Za-z0-9._:/-]+$/.test(transactionId)) {
    return json({ error: "Identificador da transação inválido" }, 400);
  }
  // A operação manual nunca finge uma consulta ao provedor. O administrador deve
  // declarar que conferiu o extrato externo; integrações automáticas usam o webhook.
  if (confirmationSource !== "external_statement_verified") {
    return json({ error: "Confirmação externa obrigatória" }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.rpc("fn_admin_confirm_manual_payout", {
    p_payout_id: payoutId,
    p_transaction_id: transactionId,
    p_admin_id: caller.user.id,
  });
  if (error) {
    // Compatibility path while older projects are waiting for the RPC migration.
    // The status predicate still makes the write idempotent and server-only.
    if (error.code === "PGRST202" || error.message.includes("fn_admin_confirm_manual_payout")) {
      const { data: updated, error: updateError } = await admin.from("doctor_payouts")
        .update({ status: "paid", paid_at: new Date().toISOString(), pix_tx_id: transactionId })
        .eq("id", payoutId).eq("status", "ready")
        .select("id, doctor_id, net_amount").maybeSingle();
      if (updateError) return json({ error: "Não foi possível confirmar o repasse" }, 500);
      if (!updated) return json({ error: "Repasse já processado ou indisponível" }, 409);
      const { error: auditError } = await admin.from("activity_logs").insert({
        user_id: null, performed_by: caller.user.id, action: "manual_payout_confirmed",
        entity_type: "doctor_payout", entity_id: payoutId,
        details: { transaction_id: transactionId, confirmation_source: "external_statement_verified", previous_status: "ready", doctor_id: updated.doctor_id, net_amount: updated.net_amount, compatibility_path: true },
      });
      if (auditError) console.error("[admin-confirm-payout] audit write failed", auditError.code);
      return json({ ok: true, result: { id: payoutId, status: "paid" } });
    }
    console.error("[admin-confirm-payout]", error.code, error.message);
    const conflict = error.message.includes("not ready");
    return json({ error: conflict ? "Repasse já processado ou indisponível" : "Não foi possível confirmar o repasse" }, conflict ? 409 : 500);
  }
  return json({ ok: true, result: data });
});
