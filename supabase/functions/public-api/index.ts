/** AloClínica Partner API v1. Authentication: Authorization: ApiKey <prefix>.<secret>. Release: 2026-08-23. */
import { createClient } from "npm:@supabase/supabase-js@2";
import { safeEqual } from "../_shared/auth.ts";
import { checkRateLimit, getCaller } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function hasScope(scopes: string[], scope: string) { return scopes.includes(scope) || scopes.includes("*"); }
function clampInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, max)) : fallback;
}
function validUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
function randomToken(bytes: number) { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function recentAuth(req: Request, maxAge = 600) { try { const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""); const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return typeof payload.iat === "number" && Date.now() / 1000 - payload.iat <= maxAge; } catch { return false; } }

const openapi = {
  openapi: "3.1.0",
  info: { title: "AloClínica Partner API", version: "1.0.0", description: "API para integrações autorizadas. Dados clínicos não fazem parte da v1." },
  servers: [{ url: "https://pwxvvimdtmvziynbspgx.supabase.co/functions/v1/public-api" }],
  components: { securitySchemes: { ApiKey: { type: "apiKey", in: "header", name: "Authorization", description: "ApiKey <prefix>.<secret>" } } },
  security: [{ ApiKey: [] }],
  paths: {
    "/v1/me": { get: { summary: "Inspeciona a credencial" } },
    "/v1/specialties": { get: { summary: "Lista especialidades", description: "Escopo catalog:read" } },
    "/v1/doctors": { get: { summary: "Busca médicos públicos", description: "Escopo catalog:read" } },
    "/v1/availability": { get: { summary: "Lista horários livres", description: "Escopo availability:read" } },
    "/v1/appointments": {
      get: { summary: "Lista agendamentos do proprietário", description: "Escopo appointments:read" },
      post: { summary: "Cria agendamento para o proprietário", description: "Escopo appointments:write. Exige Idempotency-Key." },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1\/public-api/, "") || "/";
  if (req.method === "GET" && path === "/v1/openapi.json") return json(openapi, 200, { "Cache-Control": "public, max-age=300" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: { code: "service_unavailable", message: "API indisponível" } }, 503);
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (path === "/v1/admin/keys") {
    try {
      const caller = await getCaller(req);
      if (!caller.user || !caller.isAdmin || !recentAuth(req)) return json({ error: { code: "forbidden", message: "Autenticação administrativa recente obrigatória" } }, 403);
      if (!(await checkRateLimit(`admin:${caller.user.id}`, "partner-api-keys", 20, 5, true))) return json({ error: { code: "rate_limited", message: "Limite excedido" } }, 429);
      if (req.method === "GET") { const { data, error } = await sb.from("api_keys").select("id,owner_user_id,label,prefix,scopes,rate_limit_per_min,is_active,last_used_at,created_at,revoked_at").order("created_at", { ascending: false }).limit(200); if (error) throw error; return json({ data: data ?? [] }); }
      const input = await req.json().catch(() => null) as Record<string, unknown> | null;
      if (req.method === "POST") {
        const allowed = new Set(["catalog:read", "availability:read", "appointments:read", "appointments:write"]); const scopes = input?.scopes; const rate = input?.rate_limit_per_min ?? 60;
        if (typeof input?.owner_user_id !== "string" || typeof input?.label !== "string" || !Array.isArray(scopes) || !scopes.length || scopes.some((s) => typeof s !== "string" || !allowed.has(s)) || !Number.isInteger(rate)) return json({ error: { code: "invalid_request", message: "Dados inválidos" } }, 400);
        const prefix = randomToken(6).slice(0, 8); const secret = randomToken(32); const { data: id, error } = await sb.rpc("fn_admin_create_partner_api_key", { p_actor_id: caller.user.id, p_owner_user_id: input.owner_user_id, p_label: input.label.trim(), p_prefix: prefix, p_secret: secret, p_scopes: [...new Set(scopes)], p_rate_limit: rate }); if (error) throw error;
        return json({ data: { id, prefix, api_key: `${prefix}.${secret}`, warning: "Copie agora; o segredo não será exibido novamente." } }, 201);
      }
      if (req.method === "DELETE" && typeof input?.id === "string") { const { data, error } = await sb.rpc("fn_admin_revoke_partner_api_key", { p_actor_id: caller.user.id, p_api_key_id: input.id }); if (error) throw error; return data ? json({ data: { id: input.id, revoked: true } }) : json({ error: { code: "not_found", message: "Chave não encontrada" } }, 404); }
      return json({ error: { code: "method_not_allowed", message: "Método não permitido" } }, 405);
    } catch (error) { console.error("partner api admin error", error instanceof Error ? error.message : "unknown"); return json({ error: { code: "internal_error", message: "Erro interno" } }, 500); }
  }
  let apiKeyId: string | null = null;
  let status = 500;
  let body: unknown = { error: { code: "internal_error", message: "Erro interno" } };

  try {
    const match = (req.headers.get("Authorization") ?? "").match(/^ApiKey\s+([a-z0-9_-]{8})\.([A-Za-z0-9_-]{24,})$/i);
    if (!match) return json({ error: { code: "unauthorized", message: "Credencial ausente ou inválida" } }, 401);
    const [, prefix, secret] = match;
    const { data: verifiedKeys, error: keyError } = await sb.rpc("fn_verify_partner_api_key", { p_prefix: prefix, p_secret: secret });
    let key = Array.isArray(verifiedKeys) ? verifiedKeys[0] : null;
    // Compatibilidade durante a implantação da migration: fecha seguro e pode
    // ser removida quando fn_verify_partner_api_key estiver em todos ambientes.
    if (keyError?.code === "PGRST202") {
      const { data: legacy } = await sb.from("api_keys").select("id,owner_user_id,scopes,rate_limit_per_min,secret_hash,is_active,revoked_at").eq("prefix", prefix).maybeSingle();
      if (legacy?.is_active && !legacy.revoked_at) {
        const { data: calculated } = await sb.rpc("crypt", { password: secret, salt: legacy.secret_hash });
        if (calculated && safeEqual(String(calculated), legacy.secret_hash)) key = legacy;
      }
    }
    if (!key) return json({ error: { code: "unauthorized", message: "Credencial inválida" } }, 401);
    apiKeyId = key.id;

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count, error: rateError } = await sb.from("api_request_log").select("id", { count: "exact", head: true }).eq("api_key_id", key.id).gte("created_at", since);
    if (rateError) return json({ error: { code: "service_unavailable", message: "Não foi possível validar o limite" } }, 503);
    if ((count ?? 0) >= (key.rate_limit_per_min ?? 60)) return json({ error: { code: "rate_limited", message: "Limite excedido" } }, 429, { "Retry-After": "60" });

    const scopes = (key.scopes ?? []) as string[];
    const requireScope = (scope: string) => {
      if (hasScope(scopes, scope)) return true;
      status = 403; body = { error: { code: "forbidden", message: `Escopo necessário: ${scope}` } }; return false;
    };

    if ((path === "/" || path === "/v1/me") && req.method === "GET") {
      status = 200; body = { data: { prefix, scopes, rate_limit_per_min: key.rate_limit_per_min }, meta: { api_version: "v1" } };
    } else if (path === "/v1/specialties" && req.method === "GET" && requireScope("catalog:read")) {
      let query = sb.from("specialties").select("id,name,description,is_active").eq("is_active", true).order("name");
      const search = url.searchParams.get("search")?.trim().slice(0, 80);
      if (search) query = query.ilike("name", `%${search.replace(/[%_,()]/g, "")}%`);
      const { data, error } = await query.limit(clampInt(url.searchParams.get("limit"), 50, 100));
      if (error) throw error;
      status = 200; body = { data: data ?? [] };
    } else if (path === "/v1/doctors" && req.method === "GET" && requireScope("catalog:read")) {
      let query = sb.from("doctor_profiles_public").select("id,full_name,display_name,avatar_url,crm,crm_state,crm_verified,bio,short_description,consultation_price,consultation_duration_min,rating,total_reviews,experience_years,available_now,specialty_names,has_availability");
      const doctorId = url.searchParams.get("id");
      const search = url.searchParams.get("search")?.trim().slice(0, 80);
      const specialty = url.searchParams.get("specialty")?.trim().slice(0, 80);
      if (doctorId) { if (!validUuid(doctorId)) { status = 400; body = { error: { code: "invalid_request", message: "id inválido" } }; } else query = query.eq("id", doctorId); }
      if (status !== 400) {
        if (search) query = query.ilike("full_name", `%${search.replace(/[%_,()]/g, "")}%`);
        if (specialty) query = query.contains("specialty_names", [specialty]);
        const { data, error } = await query.order("rating", { ascending: false }).limit(clampInt(url.searchParams.get("limit"), 20, 100));
        if (error) throw error;
        status = 200; body = { data: data ?? [] };
      }
    } else if (path === "/v1/availability" && req.method === "GET" && requireScope("availability:read")) {
      const doctorId = url.searchParams.get("doctor_id");
      const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
      if (!validUuid(doctorId) || !/^\d{4}-\d{2}-\d{2}$/.test(from ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) {
        status = 400; body = { error: { code: "invalid_request", message: "doctor_id, from e to são obrigatórios" } };
      } else {
        const start = new Date(`${from}T12:00:00-03:00`); const end = new Date(`${to}T12:00:00-03:00`);
        const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
        if (days < 1 || days > 31) { status = 400; body = { error: { code: "invalid_range", message: "O período deve ter entre 1 e 31 dias" } }; }
        else {
          const [{ data: doctor, error: doctorError }, { data: rules, error: rulesError }, { data: busy, error: busyError }, { data: absences, error: absenceError }] = await Promise.all([
            sb.from("doctor_profiles_public").select("id,consultation_duration_min").eq("id", doctorId).maybeSingle(),
            sb.from("availability_slots").select("day_of_week,start_time,end_time").eq("doctor_id", doctorId).eq("is_active", true),
            sb.from("appointments").select("scheduled_at,duration_minutes").eq("doctor_id", doctorId).not("status", "in", "(cancelled,no_show)").gte("scheduled_at", `${from}T00:00:00-03:00`).lte("scheduled_at", `${to}T23:59:59-03:00`),
            sb.from("doctor_absences").select("start_date,end_date").eq("doctor_id", doctorId).lte("start_date", to).gte("end_date", from),
          ]);
          if (doctorError || rulesError || busyError || absenceError) throw doctorError ?? rulesError ?? busyError ?? absenceError;
          if (!doctor) { status = 404; body = { error: { code: "not_found", message: "Médico não encontrado" } }; }
          else {
            const duration = Math.max(15, Math.min(doctor.consultation_duration_min ?? 30, 120)); const slots: string[] = [];
            for (let offset = 0; offset < days; offset++) {
              const date = new Date(start.getTime() + offset * 86400000); const dateText = date.toISOString().slice(0, 10);
              if ((absences ?? []).some((a) => dateText >= a.start_date && dateText <= a.end_date)) continue;
              for (const rule of (rules ?? []).filter((r) => r.day_of_week === date.getUTCDay())) {
                const [sh, sm] = rule.start_time.split(":").map(Number); const [eh, em] = rule.end_time.split(":").map(Number);
                for (let minute = sh * 60 + sm; minute + duration <= eh * 60 + em; minute += duration) {
                  const hh = String(Math.floor(minute / 60)).padStart(2, "0"); const mm = String(minute % 60).padStart(2, "0");
                  const candidate = new Date(`${dateText}T${hh}:${mm}:00-03:00`); const candidateEnd = candidate.getTime() + duration * 60000;
                  if (candidate.getTime() <= Date.now() + 15 * 60000) continue;
                  const overlaps = (busy ?? []).some((b) => { const bStart = Date.parse(b.scheduled_at); return bStart < candidateEnd && bStart + (b.duration_minutes ?? 30) * 60000 > candidate.getTime(); });
                  if (!overlaps) slots.push(candidate.toISOString());
                }
              }
            }
            status = 200; body = { data: { doctor_id: doctorId, timezone: "America/Sao_Paulo", duration_minutes: duration, slots } };
          }
        }
      }
    } else if (path === "/v1/appointments" && req.method === "GET" && requireScope("appointments:read")) {
      const { data: doctor } = await sb.from("doctor_profiles").select("id").eq("user_id", key.owner_user_id).maybeSingle();
      let query = sb.from("appointments").select("id,scheduled_at,status,payment_status,duration_minutes,doctor_id").order("scheduled_at", { ascending: false });
      query = doctor ? query.eq("doctor_id", doctor.id) : query.eq("patient_id", key.owner_user_id);
      const { data, error } = await query.limit(clampInt(url.searchParams.get("limit"), 50, 100)); if (error) throw error;
      status = 200; body = { data: data ?? [] };
    } else if (path === "/v1/appointments" && req.method === "POST" && requireScope("appointments:write")) {
      const idempotencyKey = req.headers.get("Idempotency-Key") ?? "";
      const payload = await req.json().catch(() => null) as { doctor_id?: unknown; scheduled_at?: unknown } | null;
      if (!payload || !validUuid(payload.doctor_id) || typeof payload.scheduled_at !== "string" || !Number.isFinite(Date.parse(payload.scheduled_at)) || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) {
        status = 400; body = { error: { code: "invalid_request", message: "doctor_id, scheduled_at e Idempotency-Key válido são obrigatórios" } };
      } else {
        const { data: patientRole, error: roleError } = await sb.from("user_roles").select("user_id").eq("user_id", key.owner_user_id).eq("role", "patient").maybeSingle();
        if (roleError) throw roleError;
        if (!patientRole) { status = 403; body = { error: { code: "patient_binding_required", message: "A v1 só agenda para o paciente proprietário da chave" } }; }
        else {
          const requestHash = await sha256(JSON.stringify({ doctor_id: payload.doctor_id, scheduled_at: new Date(payload.scheduled_at).toISOString(), patient_id: key.owner_user_id }));
          const { data, error } = await sb.rpc("fn_partner_create_appointment", { p_api_key_id: key.id, p_patient_id: key.owner_user_id, p_doctor_id: payload.doctor_id, p_scheduled_at: new Date(payload.scheduled_at).toISOString(), p_idempotency_key: idempotencyKey, p_request_hash: requestHash });
          if (error) {
            const code = /idempotency_conflict/.test(error.message) ? "idempotency_conflict" : /slot_unavailable|outside_availability|doctor_unavailable/.test(error.message) ? "slot_unavailable" : /invalid_schedule/.test(error.message) ? "invalid_schedule" : "booking_failed";
            status = code === "idempotency_conflict" ? 409 : code === "slot_unavailable" ? 409 : 400; body = { error: { code, message: code === "slot_unavailable" ? "Horário indisponível" : code === "invalid_schedule" ? "Horário inválido" : code === "idempotency_conflict" ? "A chave de idempotência já foi usada com outro conteúdo" : "Não foi possível agendar" } };
          } else { status = data?.idempotent_replay ? 200 : 201; body = { data }; }
        }
      }
    } else if (status !== 403) { status = 404; body = { error: { code: "not_found", message: "Endpoint não encontrado" } }; }

    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const { error: logError } = await sb.from("api_request_log").insert({ api_key_id: key.id, endpoint: `${req.method} ${path}`, ip, status_code: status });
    if (logError) return json({ error: { code: "service_unavailable", message: "Auditoria indisponível" } }, 503);
    await sb.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
    return json(body, status, { "X-API-Version": "v1" });
  } catch (error) {
    console.error("public-api error", { message: error instanceof Error ? error.message : "unknown", apiKeyId });
    return json({ error: { code: "internal_error", message: "Erro interno" } }, 500);
  }
});
