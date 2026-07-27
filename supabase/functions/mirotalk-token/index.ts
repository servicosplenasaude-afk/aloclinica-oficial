/**
 * mirotalk-token — emite um token JWT do MiroTalk para o participante entrar na
 * sala protegida (defesa em profundidade do vídeo de fallback).
 *
 * Requer, no SERVIDOR MiroTalk (container), que a proteção por JWT esteja ligada:
 *   JWT_KEY=<mesmo valor de MIROTALK_JWT_KEY>, API_KEY_SECRET=<MIROTALK_API_KEY>,
 *   e HOST_PROTECTED/USER_AUTH conforme a versão (ver docs/security/REMEDIATION-mirotalk-jwt.md).
 *
 * DEGRADAÇÃO SEGURA: se o MiroTalk não estiver configurado (sem API key, endpoint
 * indisponível, formato diferente da versão), retorna { token: null } — o front
 * entra SEM token (comportamento atual). Nunca quebra o vídeo.
 *
 * Body: { room: string, name?: string, presenter?: boolean }
 */
import { getCaller } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    // Só participante autenticado emite token.
    const caller = await getCaller(req);
    if (!caller.user) return json({ error: "Unauthorized" }, 401);

    const { room, name, presenter } = await req.json().catch(() => ({}));
    if (!room || typeof room !== "string") return json({ token: null, error: "room obrigatório" }, 400);

    const base = (Deno.env.get("MIROTALK_URL") || "https://meet.telemedicinaaloclinica.sbs").replace(/\/+$/, "");
    const apiKey = Deno.env.get("MIROTALK_API_KEY");
    // Sem API key configurada → degrada (front entra sem token).
    if (!apiKey) return json({ token: null, configured: false });

    // MiroTalk P2P: POST /api/v1/token → { token }. O payload de token varia por
    // versão; presenter/expire são os campos comuns. Falha → token null (fallback).
    try {
      const res = await fetch(`${base}/api/v1/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: apiKey },
        body: JSON.stringify({
          username: (name || caller.user.email || "user").slice(0, 60),
          password: "",
          presenter: presenter ? "true" : "false",
          expire: "3h",
        }),
      });
      if (!res.ok) return json({ token: null, upstream_status: res.status });
      const data = await res.json().catch(() => ({}));
      return json({ token: (data as { token?: string })?.token ?? null });
    } catch (_e) {
      return json({ token: null });
    }
  } catch (e) {
    console.error("[mirotalk-token]", e);
    return json({ token: null }, 200);
  }
});
