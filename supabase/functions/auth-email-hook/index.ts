// auth-email-hook — Send Email Hook do Supabase Auth.
//
// O GoTrue (Supabase Auth) chama esta função para ENVIAR cada e-mail de autenticação
// (confirmação de cadastro, redefinição de senha, magic link, troca de e-mail, etc.),
// em vez de usar o SMTP interno. Assim os e-mails saem pela **API do Brevo** — que já
// funciona — contornando a falha do SMTP ("Error sending recovery/confirmation email").
//
// Segurança: o GoTrue assina cada requisição (Standard Webhooks). Verificamos a
// assinatura com SEND_EMAIL_HOOK_SECRET (formato "v1,whsec_<base64>").
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { decode as b64decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("EMAIL_FROM_ADDRESS") || "noreply@telemedicinaaloclinica.sbs";
const FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") || "AloClínica";
const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";

// ── Verificação de assinatura (Standard Webhooks) ────────────────────────────
async function verifySignature(rawBody: string, headers: Headers): Promise<boolean> {
  if (!HOOK_SECRET) return false; // sem segredo configurado → rejeita (fail-closed)
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;
  const secretB64 = HOOK_SECRET.replace(/^v1,?/, "").replace(/^whsec_/, "");
  let keyBytes: Uint8Array;
  try { keyBytes = b64decode(secretB64); } catch { return false; }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = `${id}.${ts}.${rawBody}`;
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // header pode ter vários: "v1,<sig> v1,<sig2>"
  for (const part of sigHeader.split(" ")) {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    if (sig && sig === expected) return true;
  }
  return false;
}

// ── Template de e-mail (compacto, branded) ───────────────────────────────────
const BRAND = "#153C82";
function wrap(title: string, intro: string, ctaUrl: string, ctaLabel: string, foot: string) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f7fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2230">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px">
  <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e8ef">
  <tr><td style="background:${BRAND};padding:20px 26px"><span style="color:#fff;font-weight:800;font-size:18px;letter-spacing:.2px">AloClínica</span></td></tr>
  <tr><td style="padding:28px 26px">
  <h1 style="margin:0 0 12px;font-size:20px;color:${BRAND}">${title}</h1>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#3a414d">${intro}</p>
  ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px">${ctaLabel}</a>
  <p style="margin:18px 0 0;font-size:12px;color:#8a919c;word-break:break-all">Se o botão não funcionar, copie e cole este link:<br>${ctaUrl}</p>` : ""}
  <p style="margin:22px 0 0;font-size:12.5px;line-height:1.5;color:#8a919c;border-top:1px solid #eef1f5;padding-top:16px">${foot}</p>
  </td></tr></table>
  <p style="margin:14px 0 0;font-size:11px;color:#aab1bd">AloClínica · Telemedicina · Boa Vista/RR</p>
  </td></tr></table></body></html>`;
}

function buildEmail(actionType: string, d: Record<string, string>) {
  const verify = (type: string, hash: string) =>
    `${SUPABASE_URL}/auth/v1/verify?token=${hash}&type=${type}&redirect_to=${encodeURIComponent(d.redirect_to || d.site_url || "")}`;
  switch (actionType) {
    case "signup":
    case "confirmation":
      return { subject: "Confirme seu e-mail — AloClínica",
        html: wrap("Confirme seu e-mail", "Bem-vindo(a)! Confirme seu endereço de e-mail para ativar sua conta e começar a usar a AloClínica.", verify("signup", d.token_hash), "Confirmar e-mail", "Se você não criou esta conta, ignore este e-mail.") };
    case "recovery":
      return { subject: "Redefinição de senha — AloClínica",
        html: wrap("Redefinir sua senha", "Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha. O link expira em 1 hora.", verify("recovery", d.token_hash), "Redefinir senha", "Se você não pediu isto, ignore este e-mail — sua senha continua a mesma.") };
    case "magiclink":
      return { subject: "Seu link de acesso — AloClínica",
        html: wrap("Entrar na AloClínica", "Clique no botão abaixo para entrar na sua conta. O link expira em 1 hora.", verify("magiclink", d.token_hash), "Entrar", "Se você não pediu isto, ignore este e-mail.") };
    case "email_change":
      return { subject: "Confirme a alteração de e-mail — AloClínica",
        html: wrap("Confirme a alteração de e-mail", "Para concluir a troca do e-mail da sua conta, confirme clicando no botão abaixo.", verify("email_change", d.token_hash_new || d.token_hash), "Confirmar alteração", "Se você não pediu isto, entre em contato com o suporte.") };
    case "invite":
      return { subject: "Você foi convidado — AloClínica",
        html: wrap("Você foi convidado", "Você recebeu um convite para acessar a AloClínica. Clique abaixo para criar sua conta.", verify("invite", d.token_hash), "Aceitar convite", "Se não esperava este convite, ignore este e-mail.") };
    case "reauthentication":
      return { subject: "Seu código de verificação — AloClínica",
        html: wrap("Código de verificação", `Use este código para confirmar sua identidade:<br><br><span style="font-size:30px;font-weight:800;letter-spacing:6px;color:${BRAND}">${d.token}</span>`, "", "", "Se você não pediu isto, ignore este e-mail.") };
    default:
      return { subject: "AloClínica — verificação",
        html: wrap("Verificação de conta", "Clique no botão abaixo para continuar.", verify(actionType, d.token_hash), "Continuar", "Se você não reconhece esta ação, ignore este e-mail.") };
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const rawBody = await req.text();
    if (!(await verifySignature(rawBody, req.headers))) {
      return new Response(JSON.stringify({ error: { message: "invalid signature" } }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    if (!BREVO_API_KEY) {
      console.error("[auth-email-hook] BREVO_API_KEY ausente");
      return new Response(JSON.stringify({ error: { message: "email provider not configured" } }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    const payload = JSON.parse(rawBody);
    const to = payload?.user?.email;
    const ed = payload?.email_data ?? {};
    const actionType = String(ed.email_action_type ?? "");
    if (!to) return new Response(JSON.stringify({ error: { message: "no recipient" } }), { status: 400, headers: { "Content-Type": "application/json" } });

    const { subject, html } = buildEmail(actionType, ed);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { name: FROM_NAME, email: FROM_EMAIL }, to: [{ email: to }], subject, htmlContent: html }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[auth-email-hook] Brevo falhou", res.status, t.slice(0, 300));
      // GoTrue trata não-2xx como falha → devolve erro no formato esperado.
      return new Response(JSON.stringify({ error: { message: `brevo ${res.status}`, http_code: res.status } }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    // Sucesso: GoTrue espera 200 com corpo vazio (ou {}).
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[auth-email-hook]", e);
    return new Response(JSON.stringify({ error: { message: (e as Error).message } }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
