import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });

const sources = {
  mp: read("supabase/functions/mercadopago-webhook/index.ts"),
  pagbank: read("supabase/functions/pagbank-webhook/index.ts"),
  email: read("supabase/functions/send-email/index.ts"),
  whatsapp: read("supabase/functions/send-whatsapp/index.ts"),
  push: read("supabase/functions/send-push-notification/index.ts"),
  memed: read("supabase/functions/memed-prescriber/index.ts"),
  docuseal: read("supabase/functions/docuseal-webhook/index.ts"),
  config: read("supabase/config.toml"),
};

check("Mercado Pago webhook fail-closed", sources.mp.includes("MERCADOPAGO_WEBHOOK_SECRET") && sources.mp.includes("validateSignature"), "HMAC secret and signature validation");
check("Mercado Pago retries transient lookups", sources.mp.includes("payment lookup failed") && !/if \(!res\.ok\) return;/.test(sources.mp), "non-2xx gateway lookups propagate as webhook errors");
check("PagBank webhook authenticated", sources.pagbank.includes("pagbankVerifyWebhook") && sources.pagbank.includes("pagbank_order_id"), "authenticity token plus order reconciliation");
check("Email provider fails closed", sources.email.includes('const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")') && !sources.email.includes("Email logged"), "no false delivery success");
check("Evolution requires TLS", sources.whatsapp.includes('baseUrl.startsWith("https://")') && !sources.whatsapp.includes('"http://"'), "no plaintext downgrade");
check("Push has complete VAPID config", ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"].every((v) => sources.push.includes(`Deno.env.get(\"${v}\")`)), "public/private pair and contact subject");
check("Memed requires server credentials", ["MEMED_API_KEY", "MEMED_SECRET_KEY"].every((v) => sources.memed.includes(`Deno.env.get(\"${v}\")`)), "credentials remain server-side");
check("DocuSeal webhook fail-closed", sources.docuseal.includes("DOCUSEAL_WEBHOOK_SECRET") && sources.docuseal.includes("safeEqual"), "shared secret constant-time validation");
for (const fn of ["mercadopago-webhook", "pagbank-webhook", "docuseal-webhook"]) {
  check(`${fn} public gateway route declared`, new RegExp(`\\[functions\\.${fn.replaceAll("-", "\\-")}\\]\\s*verify_jwt\\s*=\\s*false`, "m").test(sources.config), "provider callbacks bypass JWT but enforce their own signature");
}

const requiredSecrets = [
  "MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET",
  "PAGBANK_TOKEN", "PAGBANK_ENV", "PAGBANK_ACCOUNT_ID",
  "BREVO_API_KEY", "EMAIL_FROM_ADDRESS", "EMAIL_FROM_NAME",
  "EVOLUTION_API_URL", "EVOLUTION_API_KEY",
  "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
  "MEMED_API_KEY", "MEMED_SECRET_KEY",
  "DOCUSEAL_BASE", "DOCUSEAL_API_KEY", "DOCUSEAL_WEBHOOK_SECRET",
];

const inspectEnvironment = process.argv.includes("--check-env");
if (inspectEnvironment) {
  for (const name of requiredSecrets) check(`secret:${name}`, Boolean(process.env[name]?.trim()), "presence only; value never printed");
}

for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name} - ${item.detail}`);
if (!inspectEnvironment) console.log("INFO Run with --check-env only inside the target Edge Functions secret environment; values are never printed.");

const failed = checks.filter((item) => !item.ok);
console.log(`SUMMARY ${checks.length - failed.length}/${checks.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
