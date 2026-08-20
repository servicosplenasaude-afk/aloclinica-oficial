import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { checkRateLimit, getCaller } from "../_shared/auth.ts";

type Audience = "all" | "patient" | "doctor" | "clinic" | "subscribers";
const AUDIENCES = new Set<Audience>(["all", "patient", "doctor", "clinic", "subscribers"]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function tokenIssuedRecently(req: Request, maxAgeSeconds = 600): boolean {
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.iat === "number" && Date.now() / 1000 - payload.iat <= maxAgeSeconds;
  } catch { return false; }
}

async function pagedUserIds(queryForRange: (from: number, to: number) => PromiseLike<{ data: Array<{ user_id: string }> | null; error: unknown }>) {
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryForRange(from, from + 999);
    if (error) throw new Error("Audience lookup failed");
    ids.push(...(data ?? []).map((row) => row.user_id));
    if ((data?.length ?? 0) < 1000) break;
  }
  return ids;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const caller = await getCaller(req);
  if (!caller.user) return json({ error: "Unauthorized" }, 401);
  if (!caller.isAdmin) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const audience = body.audience as Audience;
  const dryRun = body.dry_run !== false;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const link = typeof body.link === "string" ? body.link.trim() : "";
  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key : "";
  if (!AUDIENCES.has(audience)) return json({ error: "Invalid audience" }, 400);
  if (!dryRun && (!title || !message || title.length > 120 || message.length > 500)) return json({ error: "Invalid notification content" }, 400);
  if (link && (!link.startsWith("/") || link.startsWith("//"))) return json({ error: "Only internal links are allowed" }, 400);
  if (!dryRun) {
    if (!tokenIssuedRecently(req)) return json({ error: "Recent authentication required" }, 403);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) return json({ error: "Invalid idempotency key" }, 400);
    const allowed = await checkRateLimit(`admin:${caller.user.id}`, "admin-broadcast", 3, 60, true);
    if (!allowed) return json({ error: "Broadcast rate limit exceeded" }, 429);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let candidateIds: string[] = [];
  try {
    if (audience === "all") candidateIds = await pagedUserIds((from, to) => admin.from("profiles").select("user_id").range(from, to));
    else if (audience === "subscribers") candidateIds = await pagedUserIds((from, to) => admin.from("push_subscriptions").select("user_id").range(from, to));
    else candidateIds = await pagedUserIds((from, to) => admin.from("user_roles").select("user_id").eq("role", audience).range(from, to));
  } catch { return json({ error: "Audience lookup failed" }, 500); }
  candidateIds = [...new Set(candidateIds.filter(Boolean))];

  const optedOut = new Set<string>();
  for (let offset = 0; offset < candidateIds.length; offset += 500) {
    const { data, error } = await admin.from("notification_preferences").select("user_id, prefs").in("user_id", candidateIds.slice(offset, offset + 500));
    if (error) return json({ error: "Preference lookup failed" }, 500);
    for (const row of data ?? []) {
      const prefs = row.prefs && typeof row.prefs === "object" ? row.prefs as Record<string, unknown> : {};
      if (prefs.announcement === false || (audience === "subscribers" && prefs.channel_push === false)) optedOut.add(row.user_id);
    }
  }
  const recipients = candidateIds.filter((id) => !optedOut.has(id));
  const summary = { audience, candidates: candidateIds.length, eligible: recipients.length, opted_out: optedOut.size };
  if (dryRun) return json({ dry_run: true, ...summary });
  const { data: delivered, error: deliveryError } = await admin.rpc("fn_admin_broadcast_deliver", {
    p_idempotency_key: idempotencyKey, p_actor_id: caller.user.id, p_audience: audience,
    p_title: title, p_message: message, p_link: link || null,
  });
  if (deliveryError) return json({ error: "Broadcast delivery failed" }, 500);
  return json(delivered);
});
