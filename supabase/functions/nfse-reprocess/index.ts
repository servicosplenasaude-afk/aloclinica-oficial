// nfse-reprocess — reconcilia notas fiscais que ficaram "processando".
//
// A emissão na Focus NFe é assíncrona: nem sempre a nota fica "autorizado" dentro
// da janela de polling do emit-nfse (a prefeitura pode demorar). Este job (pg_cron,
// a cada 15 min) pega as notas ainda "processando" e RE-INVOCA emit-nfse — que é
// idempotente por `ref` (a Focus não duplica) e, ao ver "autorizado", grava o link
// e envia e-mail/WhatsApp (com claim atômico em sent_at → nunca duplica o envio).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isInternalOrService } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!isInternalOrService(req)) return json({ error: "forbidden" }, 403);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cutoffNew = new Date(Date.now() - 30_000).toISOString();     // não corre com o emit inicial
    const cutoffOld = new Date(Date.now() - 3 * 24 * 3600_000).toISOString(); // desiste após 3 dias

    const { data: pending, error } = await supabase.from("nfse_invoices")
      .select("ref, resource_type, resource_id")
      .eq("status", "processando")
      .lt("created_at", cutoffNew)
      .gt("created_at", cutoffOld)
      .limit(50);
    if (error) return json({ error: error.message }, 500);
    if (!pending?.length) return json({ processed: 0 });

    let ok = 0;
    for (const inv of pending) {
      try {
        await supabase.functions.invoke("emit-nfse", {
          body: { resource_type: inv.resource_type, resource_id: inv.resource_id },
        });
        ok++;
      } catch (e) {
        console.error("[nfse-reprocess]", inv.ref, (e as Error).message);
      }
    }
    return json({ processed: ok, total: pending.length });
  } catch (e) {
    console.error("[nfse-reprocess]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
