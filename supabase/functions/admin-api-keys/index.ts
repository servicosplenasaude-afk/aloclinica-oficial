import { createClient } from "npm:@supabase/supabase-js@2";
// Administrative credential lifecycle for Partner API v1 (2026-08-23).
import { checkRateLimit, getCaller } from "../_shared/auth.ts";

const allowedScopes = new Set(["catalog:read", "availability:read", "appointments:read", "appointments:write"]);
const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
function randomToken(bytes: number) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function recentAuth(req: Request, maxAgeSeconds = 600) {
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.iat === "number" && Date.now() / 1000 - payload.iat <= maxAgeSeconds;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS" } });
  try {
    const caller = await getCaller(req);
    if (!caller.user || !caller.isAdmin) return json({ error: "forbidden" }, 403);
    if (!recentAuth(req)) return json({ error: "recent_auth_required" }, 403);
    if (!(await checkRateLimit(`admin:${caller.user.id}`, "admin-api-keys", 20, 5, true))) return json({ error: "rate_limited" }, 429);
    const url = Deno.env.get("SUPABASE_URL"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "service_unavailable" }, 503);
    const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    if (req.method === "GET") {
      const { data, error } = await sb.from("api_keys").select("id,owner_user_id,label,prefix,scopes,rate_limit_per_min,is_active,last_used_at,created_at,revoked_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return json({ data: data ?? [] });
    }
    const payload = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (req.method === "POST") {
      const owner = payload?.owner_user_id; const label = payload?.label; const scopes = payload?.scopes; const rate = payload?.rate_limit_per_min ?? 60;
      if (typeof owner !== "string" || !/^[0-9a-f-]{36}$/i.test(owner) || typeof label !== "string" || !Array.isArray(scopes) || scopes.length < 1 || scopes.some((s) => typeof s !== "string" || !allowedScopes.has(s)) || !Number.isInteger(rate) || Number(rate) < 1 || Number(rate) > 600) return json({ error: "invalid_request" }, 400);
      const prefix = randomToken(6).slice(0, 8); const secret = randomToken(32);
      const { data: id, error } = await sb.rpc("fn_admin_create_partner_api_key", { p_actor_id: caller.user.id, p_owner_user_id: owner, p_label: label.trim(), p_prefix: prefix, p_secret: secret, p_scopes: [...new Set(scopes)], p_rate_limit: rate });
      if (error) throw error;
      return json({ data: { id, prefix, api_key: `${prefix}.${secret}`, warning: "Copie agora; o segredo não será exibido novamente." } }, 201);
    }
    if (req.method === "DELETE") {
      const id = payload?.id;
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_request" }, 400);
      const { data, error } = await sb.rpc("fn_admin_revoke_partner_api_key", { p_actor_id: caller.user.id, p_api_key_id: id });
      if (error) throw error; if (!data) return json({ error: "not_found_or_revoked" }, 404);
      return json({ data: { id, revoked: true } });
    }
    return json({ error: "method_not_allowed" }, 405);
  } catch (error) {
    console.error("admin-api-keys error", error instanceof Error ? error.message : "unknown");
    return json({ error: "internal_error" }, 500);
  }
});
