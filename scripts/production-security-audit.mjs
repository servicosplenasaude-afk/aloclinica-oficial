#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const findings = [];

function add(level, area, message, file = "") {
  findings.push({ level, area, message, file });
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function walk(dir, files = []) {
  for (const entry of readdirSync(join(root, dir))) {
    const relative = join(dir, entry).replace(/\\/g, "/");
    const full = join(root, relative);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(relative, files);
    else files.push(relative);
  }
  return files;
}

const expectedPublicFunctions = new Set([
  "mercadopago-webhook",
  "pagbank-webhook",
  "docuseal-webhook",
  "vidaas-callback",
  "robots-txt",
  "sitemap-xml",
  "guest-checkout",
  "guest-consultation",
  "validate-invite-code",
  "validate-council",
  "b2b-lead-notification",
  "create-admin-account",
  "process-refund",
  "seed-test-doctors",
  "seed-test-users",
  "daily-backup",
  "scheduled-tasks",
  "appointment-reminders",
  "appointment-confirmed",
  "lembrete-consultas",
  "cart-abandonment",
  "notify-expired-prescriptions",
  "weekly-admin-report",
  "ai-ticket-triage",
  "auto-clinical-summary",
  "suggest-reschedule",
  "verify-crm",
  "rate-limiter",
  // Públicas por natureza / que se autoprotegem (guard interno) — adicionadas conforme criadas:
  "log-failed-login",        // pré-autenticação (registra tentativas de login falhas)
  "mp-oauth-callback",       // callback OAuth do Mercado Pago (redirect externo)
  "public-api",              // API pública (autentica por api_key)
  "doctor-ical-feed",        // feed iCal autenticado por token na URL (ical_token)
  "emit-nfse",               // NFS-e — guard isInternalOrService + admin
  "post-consultation-survey",// cron — guard isInternalOrService
  "patient-nudges",          // cron — guard isInternalOrService
  "no-show-reminder-tick",   // cron — guard x-tick-secret
  "auth-email-hook",         // Send Email Hook do GoTrue — guard: assinatura Standard Webhooks
]);

const config = read("supabase/config.toml");
const publicFunctionMatches = [...config.matchAll(/\[functions\.([^\]]+)\]\s*\nverify_jwt\s*=\s*false/g)];
for (const match of publicFunctionMatches) {
  const name = match[1];
  if (!expectedPublicFunctions.has(name)) {
    add("error", "supabase", `Unexpected public edge function: ${name}`, "supabase/config.toml");
  }
}

const reviewedPublicFunctions = new Map([
  ["mercadopago-webhook", ["x-signature"]],
  ["pagbank-webhook", ["pagbankVerifyWebhook"]],
  ["log-failed-login", ["checkRateLimit"]],
  ["docuseal-webhook", ["DOCUSEAL_WEBHOOK_SECRET", "safeEqual"]],
  ["mp-oauth-callback", ["mp_oauth_states"]],
  // A comparação do hash ocorre dentro da RPC privada (service_role-only),
  // para que a Edge Function nunca receba nem registre secret_hash.
  ["public-api", ["fn_verify_partner_api_key", "rateError"]],
  ["doctor-ical-feed", ["ical_token"]],
  ["robots-txt", []],
  ["daily-backup", ["isInternalOrService"]],
  ["scheduled-tasks", ["isInternalOrService"]],
  ["appointment-confirmed", ["isInternalOrService"]],
  ["emit-nfse", ["isInternalOrService"]],
  ["auth-email-hook", ["webhook-signature", "verifySignature"]],
  ["appointment-reminders", ["isInternalOrService"]],
  ["lembrete-consultas", ["isInternalOrService"]],
  ["post-consultation-survey", ["isInternalOrService"]],
  ["patient-nudges", ["isInternalOrService"]],
  ["no-show-reminder-tick", ["AUTO_PAYOUT_TICK_SECRET", "safeEqual"]],
]);
for (const match of publicFunctionMatches) {
  const name = match[1];
  const evidence = reviewedPublicFunctions.get(name);
  if (!evidence) {
    add("error", "supabase", `Public function has no reviewed auth model: ${name}`, "supabase/config.toml");
    continue;
  }
  const functionFile = `supabase/functions/${name}/index.ts`;
  try {
    const content = read(functionFile);
    for (const marker of evidence) {
      if (!content.includes(marker)) add("error", "supabase", `Public function ${name} lacks auth evidence: ${marker}`, functionFile);
    }
  } catch {
    add("error", "supabase", `Configured public function has no implementation: ${name}`, functionFile);
  }
}

for (const sensitive of ["assign-role", "admin-reset-password", "mercadopago-charge-saved-card", "withdraw", "lgpd-export-user"]) {
  if (config.includes(`[functions.${sensitive}]\nverify_jwt = false`)) {
    add("error", "supabase", `Sensitive function disables JWT: ${sensitive}`, "supabase/config.toml");
  }
}

const client = read("src/integrations/supabase/client.ts");
const supabaseConfig = read("src/lib/supabase-config.ts");
if (!client.includes("@/lib/supabase-config") || !supabaseConfig.includes("import.meta.env.VITE_SUPABASE_URL")) {
  add("warn", "env", "Supabase URL should read VITE_SUPABASE_URL through centralized config.", "src/lib/supabase-config.ts");
}
if (!client.includes("@/lib/supabase-config") || !supabaseConfig.includes("import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY")) {
  add("warn", "env", "Supabase publishable key should read VITE_SUPABASE_PUBLISHABLE_KEY through centralized config.", "src/lib/supabase-config.ts");
}

const nginx = read("nginx.conf");
for (const required of [
  "Strict-Transport-Security",
  "Content-Security-Policy",
  "X-Frame-Options",
  "Permissions-Policy",
  "server_tokens off",
]) {
  if (!nginx.includes(required)) add("error", "nginx", `Missing ${required}`, "nginx.conf");
}
if (!/location \^~ \/dashboard[\s\S]+no-store/.test(nginx)) {
  add("error", "nginx", "Authenticated dashboard routes must send Cache-Control: no-store.", "nginx.conf");
}
if (!/location \^~ \/consulta[\s\S]+no-store/.test(nginx)) {
  add("error", "nginx", "Consultation routes must send Cache-Control: no-store.", "nginx.conf");
}

const workflow = read(".github/workflows/deploy.yml");
for (const required of ["npm run build", "pages deploy dist --project-name aloclinica-production", "https://aloclinica.com.br${path}"]) {
  if (!workflow.includes(required)) add("error", "deploy", `Deploy workflow missing: ${required}`, ".github/workflows/deploy.yml");
}
if (workflow.includes("continue-on-error: true")) {
  add("error", "deploy", "Production deploy must not ignore Edge Function failures.", ".github/workflows/deploy.yml");
}
for (const seedFunction of ["seed-test-users", "seed-test-doctors"]) {
  if (!workflow.includes(seedFunction)) {
    add("error", "deploy", `Production deploy must explicitly exclude ${seedFunction}.`, ".github/workflows/deploy.yml");
  }
}
if (workflow.includes("supabase/seeds") || workflow.includes("db seed")) {
  add("error", "deploy", "Production workflow must not load demo/test seed data.", ".github/workflows/deploy.yml");
}

const cloudflareHeaders = read("public/_headers");
const csp = cloudflareHeaders.match(/Content-Security-Policy:\s*([^\r\n]+)/)?.[1] ?? "";
const scriptSrc = csp.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] ?? "";
if (!scriptSrc) add("error", "csp", "Cloudflare headers must define script-src.", "public/_headers");
if (scriptSrc.includes("'unsafe-inline'") || scriptSrc.includes("'unsafe-eval'")) {
  add("error", "csp", "script-src must not allow unsafe-inline or unsafe-eval.", "public/_headers");
}
for (const htmlFile of ["index.html", "public/offline.html"]) {
  const html = read(htmlFile);
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (!match[1]) continue;
    const hash = `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`;
    if (!scriptSrc.includes(hash)) {
      add("error", "csp", `Inline script hash is missing from script-src: ${hash}`, htmlFile);
    }
  }
}

const databaseSafetyWorkflow = read(".github/workflows/database-safety.yml");
for (const required of [
  "supabase migration list --linked",
  "verify-migration-reconciliation.mjs",
]) {
  if (!databaseSafetyWorkflow.includes(required)) add("error", "database", `Database safety workflow missing: ${required}`, ".github/workflows/database-safety.yml");
}
if (/migration\s+repair/i.test(databaseSafetyWorkflow)) {
  add("error", "database", "Automated migration repair is forbidden.", ".github/workflows/database-safety.yml");
}

const p0Migration = read("supabase/migrations/20260819000100_p0_security_hotfix.sql");
for (const required of [
  'DROP POLICY IF EXISTS "Users can view all profiles"',
  "REVOKE ALL ON FUNCTION public.verify_document_public(text) FROM PUBLIC",
  "GRANT EXECUTE ON FUNCTION public.check_ai_assistant_rate_limit(text, text, integer, integer) TO service_role",
]) {
  if (!p0Migration.includes(required)) add("error", "database", `Missing P0 database hardening: ${required}`, "supabase/migrations/20260819000100_p0_security_hotfix.sql");
}

const sourceFiles = walk("src").concat(walk("supabase/functions"));
const secretPatterns = [
  { label: "private api token", regex: /(sk_live_|sk_test_|SG\.[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})/ },
  { label: "service role key", regex: /(SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY)\s*=\s*["'][^"']{12,}["']/i },
  { label: "hardcoded password key", regex: /(SECRET_KEY|ACCESS_TOKEN|PRIVATE_KEY)\s*=\s*["'][^"']{12,}["']/i },
];

for (const file of sourceFiles) {
  if (!/\.(ts|tsx|js|mjs)$/.test(file)) continue;
  const content = read(file);
  for (const pattern of secretPatterns) {
    if (pattern.regex.test(content)) {
      add("error", "secrets", `Possible hardcoded ${pattern.label}.`, file);
    }
  }
}

const errors = findings.filter((item) => item.level === "error");
const warnings = findings.filter((item) => item.level === "warn");

console.log(`Production security audit: ${new Date().toISOString()}`);
if (findings.length === 0) {
  console.log("No findings.");
} else {
  console.table(findings);
}
console.log(`Errors: ${errors.length} | Warnings: ${warnings.length}`);

if (errors.length > 0) process.exit(1);
