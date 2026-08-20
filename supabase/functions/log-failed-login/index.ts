// log-failed-login — registra uma tentativa de login que FALHOU em
// failed_login_attempts, para alimentar o painel de Segurança (que antes ficava
// sempre vazio, pois nada gravava nessa tabela).
//
// Chamada pelo front no erro de login. O IP é capturado no SERVIDOR (o navegador
// não sabe o próprio IP público de forma confiável). verify_jwt = false porque
// quem chama ainda não está autenticado (falhou o login).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { email, reason } = await req.json().catch(() => ({}));
    if (!email) return json({ ok: false });

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const ua = (req.headers.get("user-agent") ?? "").slice(0, 400) || null;
    // This endpoint is intentionally anonymous. Bound writes by the edge-provided
    // client IP so it cannot be used to flood the audit table.
    const allowed = await checkRateLimit(ip ?? "unknown", "log-failed-login", 20, 1, true);
    if (!allowed) return json({ error: "Too many requests" }, 429);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("failed_login_attempts").insert({
      email: String(email).toLowerCase().slice(0, 255),
      ip_address: ip,
      user_agent: ua,
      reason: String(reason ?? "invalid_credentials").slice(0, 100),
    });

    return json({ ok: true });
  } catch (e) {
    // Nunca falha o fluxo de login por causa do log — só registra o erro.
    console.error("[log-failed-login]", e);
    return json({ ok: false });
  }
});
