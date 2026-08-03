// ============================================================================
// pagbank-public-key — devolve a chave PÚBLICA do PagBank para o navegador
// criptografar os dados do cartão (RSA) antes de enviar. O token da conta fica
// SEMPRE no servidor; o frontend só recebe a chave pública (que é pública mesmo).
// Validado no sandbox (POST /public-keys → 200 com public_key).
// ============================================================================
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { getCaller } from "../_shared/auth.ts";
import { pagbankBaseUrl, pagbankConfigured, pagbankToken } from "../_shared/pagbank.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (!pagbankConfigured()) return json({ error: "PagBank não configurado (PAGBANK_TOKEN)." }, 503);
    const caller = await getCaller(req);
    if (!caller.user) return json({ error: "não autenticado" }, 401);

    const r = await fetch(`${pagbankBaseUrl()}/public-keys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pagbankToken()}`,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ type: "card" }),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await r.json().catch(() => ({}))) as { public_key?: string };
    if (!r.ok || !data.public_key) {
      return json({ error: "falha ao obter a chave pública", details: data }, r.status);
    }
    return json({ public_key: data.public_key });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});
