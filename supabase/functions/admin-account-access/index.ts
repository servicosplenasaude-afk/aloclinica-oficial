import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getCaller } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jwtIssuedAt(req: Request): number | null {
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    return typeof parsed.iat === "number" ? parsed.iat : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller.user || !caller.isAdmin) return json({ error: "Unauthorized" }, 401);

  const issuedAt = jwtIssuedAt(req);
  if (!issuedAt || Date.now() / 1000 - issuedAt > 15 * 60) {
    return json({ error: "Recent authentication required", code: "RECENT_AUTH_REQUIRED" }, 403);
  }

  if (!(await checkRateLimit(caller.user.id, "admin-account-access", 10, 5, true))) {
    return json({ error: "Too many requests" }, 429);
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  const action = body.action;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
    return json({ error: "Invalid user" }, 400);
  }
  if (action !== "suspend" && action !== "reactivate") return json({ error: "Invalid action" }, 400);
  if (targetUserId === caller.user.id) return json({ error: "Self suspension is not allowed" }, 409);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: target, error: targetError } = await admin.auth.admin.getUserById(targetUserId);
  if (targetError || !target.user) return json({ error: "User not found" }, 404);

  // Write an audit intent first. If durable audit storage is unavailable, the
  // privileged Auth operation must not proceed (fail closed).
  const { error: auditError } = await admin.from("activity_logs").insert({
    user_id: caller.user.id,
    action: action === "suspend" ? "user_account.suspend_requested" : "user_account.reactivate_requested",
    entity_type: "user_account",
    entity_id: targetUserId,
    metadata: {
      actor_id: caller.user.id,
      target_user_id: targetUserId,
      operation: action,
      limitation: "existing_access_tokens_may_remain_valid_until_expiry",
    },
  });
  if (auditError) return json({ error: "Audit unavailable" }, 503);

  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    ban_duration: action === "suspend" ? "876000h" : "none",
  });
  if (error) {
    console.error("[admin-account-access] auth update failed", error.message);
    return json({ error: "Account update failed" }, 500);
  }

  return json({
    ok: true,
    status: action === "suspend" ? "suspended" : "active",
    notice: "Existing access tokens may remain valid until they expire.",
  });
});
