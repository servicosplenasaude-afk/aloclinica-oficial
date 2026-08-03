// ============================================================================
// pagbank-status — diagnóstico da conexão com o PagBank (somente ADMIN).
// Assim que o secret PAGBANK_TOKEN for configurado, chame esta função para
// confirmar, na hora, se o token funciona — SEM precisar de consulta/checkout.
// Cria uma cobrança PIX de R$ 1,00 de TESTE no sandbox (nunca é cobrada de
// ninguém) só para validar autenticação + criação de pedido.
// ============================================================================
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { getCaller } from "../_shared/auth.ts";
import { pagbankConfigured, pagbankCreateOrder } from "../_shared/pagbank.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const caller = await getCaller(req);
    if (!caller.isAdmin) return json({ error: "acesso restrito a administradores" }, 403);

    const env = (Deno.env.get("PAGBANK_ENV") ?? "sandbox").toLowerCase();
    if (!pagbankConfigured()) {
      return json({ configured: false, env, message: "Defina o secret PAGBANK_TOKEN no Supabase." });
    }

    // Pedido de teste (R$ 1,00) — só valida a conexão; ninguém paga.
    const { ok, status, data } = await pagbankCreateOrder({
      reference_id: "teste-conexao",
      customer: { name: "Teste Conexao", email: "teste@aloclinica.com.br", tax_id: "12345678909" },
      items: [{ name: "Teste de conexao PagBank", quantity: 1, unit_amount: 100 }],
      qr_codes: [{ amount: { value: 100 } }],
    });

    const gotQr = !!((data.qr_codes as Array<Record<string, unknown>> | undefined)?.[0]?.text);
    return json({
      configured: true,
      env,
      connection_ok: ok && gotQr,
      http_status: status,
      got_qr: gotQr,
      order_id: data.id ?? null,
      error: ok ? undefined : data,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});
