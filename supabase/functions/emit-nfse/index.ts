// emit-nfse — emite a Nota Fiscal de Serviço (NFS-e) de um serviço pago (consulta
// agendada OU plantão/urgência), GRAVA o registro em public.nfse_invoices, e ENVIA
// o PDF por e-mail e WhatsApp ao paciente.
//
// Provedor: Focus NFe (focusnfe.com.br) — API REST (token + JSON), NFS-e Nacional.
//
// GATE (fail-open): enquanto FOCUS_NFE_TOKEN / NFSE_* não estiverem definidos, a
// emissão é PULADA sem erro — nada quebra no fluxo de pagamento. Quando o contador
// cadastrar a empresa na Focus e preencher os secrets, a emissão liga sozinha.
//
// Entrada (ambos aceitos):
//   { appointment_id }                          // legado (consulta agendada)
//   { resource_type: "appointment"|"queue", resource_id }
//
// Chamado internamente pelo mercadopago-webhook (pagamento aprovado) e pelo
// reprocessador (nfse-reprocess).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isInternalOrService } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const CFG = {
  token: Deno.env.get("FOCUS_NFE_TOKEN") ?? "",
  ambiente: (Deno.env.get("FOCUS_NFE_AMBIENTE") ?? "homologacao").toLowerCase(),
  cnpj: (Deno.env.get("NFSE_CNPJ") ?? "").replace(/\D/g, ""),
  inscricaoMunicipal: Deno.env.get("NFSE_INSCRICAO_MUNICIPAL") ?? "",
  cityIbge: Deno.env.get("NFSE_CITY_IBGE") ?? "",
  itemListaServico: Deno.env.get("NFSE_ITEM_LISTA_SERVICO") ?? "",
  codigoTributarioMunicipio: Deno.env.get("NFSE_CODIGO_TRIBUTARIO_MUNICIPIO") ?? "",
  issRate: Number(Deno.env.get("NFSE_ISS_RATE") ?? "0"),
  serviceDesc: Deno.env.get("NFSE_SERVICE_DESC") ?? "Teleconsulta médica (telemedicina) — prestação de serviço de saúde à distância.",
};
export const nfseBaseUrl = () => (CFG.ambiente === "producao" ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br");
const isConfigured = () => Boolean(CFG.token && CFG.cnpj && CFG.cityIbge && CFG.itemListaServico);
const auth = () => "Basic " + btoa(`${CFG.token}:`);

async function emitFocus(ref: string, body: unknown) {
  const post = await fetch(`${nfseBaseUrl()}/v2/nfse?ref=${encodeURIComponent(ref)}`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const posted = await post.json().catch(() => ({}));
  if (post.status >= 400 && posted?.codigo !== "nfse_ja_existe") {
    throw new Error(`focus emit ${post.status}: ${JSON.stringify(posted).slice(0, 400)}`);
  }
  let last: Record<string, unknown> = posted;
  for (let i = 0; i < 6; i++) {
    const g = await fetch(`${nfseBaseUrl()}/v2/nfse/${encodeURIComponent(ref)}`, { headers: { Authorization: auth() } });
    last = await g.json().catch(() => ({}));
    const st = String(last?.status ?? "");
    if (st === "autorizado") return last;
    if (st === "erro_autorizacao" || st === "cancelado") return last;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return last; // ainda processando
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!isInternalOrService(req)) return json({ error: "forbidden" }, 403);

  try {
    const body = await req.json().catch(() => ({}));
    // Resolve o recurso: legado (appointment_id) ou genérico (resource_type/id).
    const resourceType: string = body.appointment_id ? "appointment" : String(body.resource_type ?? "");
    const resourceId: string = body.appointment_id ? String(body.appointment_id) : String(body.resource_id ?? "");
    if (!["appointment", "queue"].includes(resourceType) || !resourceId) {
      return json({ error: "resource_type (appointment|queue) + resource_id obrigatórios" }, 400);
    }
    const ref = `${resourceType}_${resourceId}`;

    if (!isConfigured()) {
      return json({ skipped: true, reason: "NFS-e não configurada (defina FOCUS_NFE_TOKEN e NFSE_*)" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Carrega o recurso (paciente + valor + status de pagamento).
    let patientId: string | null = null;
    let valor = 0;
    let paid = false;
    if (resourceType === "appointment") {
      const { data } = await supabase.from("appointments")
        .select("patient_id, price_at_booking, payment_status").eq("id", resourceId).single();
      if (!data) return json({ error: "appointment not found" }, 404);
      patientId = data.patient_id;
      valor = Number(data.price_at_booking ?? 0);
      paid = ["approved", "confirmed", "received", "paid"].includes(String(data.payment_status));
    } else {
      const { data } = await supabase.from("on_demand_queue")
        .select("patient_id, price, payment_id, status").eq("id", resourceId).single();
      if (!data) return json({ error: "queue item not found" }, 404);
      patientId = data.patient_id;
      valor = Number(data.price ?? 0);
      // Plantão: "pago" = tem payment_id (fluxo síncrono) ou já entrou/concluiu na fila.
      paid = Boolean(data.payment_id) || ["waiting", "assigned", "in_progress", "completed"].includes(String(data.status));
    }
    if (!paid || valor <= 0) return json({ skipped: true, reason: "sem pagamento aprovado / valor zero" });

    const { data: patient } = patientId
      ? await supabase.from("profiles").select("first_name, last_name, phone, cpf").eq("user_id", patientId).single()
      : { data: null } as { data: null };
    let patientEmail = "";
    if (patientId) {
      const { data: au } = await supabase.auth.admin.getUserById(patientId);
      patientEmail = au?.user?.email ?? "";
    }
    const patientName = patient ? `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() : "Paciente";
    const amountBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

    // Registro inicial (processando) — idempotente por ref.
    await supabase.from("nfse_invoices").upsert({
      ref, resource_type: resourceType, resource_id: resourceId, patient_id: patientId, valor,
      status: "processando", provider: "focusnfe", updated_at: new Date().toISOString(),
    } as never, { onConflict: "ref" });

    // Emite via Focus.
    const dpsBody: Record<string, unknown> = {
      data_emissao: new Date().toISOString().slice(0, 19),
      prestador: { cnpj: CFG.cnpj, inscricao_municipal: CFG.inscricaoMunicipal || undefined, codigo_municipio: CFG.cityIbge },
      tomador: { cpf: (patient?.cpf ?? "").replace(/\D/g, "") || undefined, razao_social: patientName, email: patientEmail || undefined },
      servico: {
        aliquota: CFG.issRate, discriminacao: CFG.serviceDesc, iss_retido: false,
        item_lista_servico: CFG.itemListaServico,
        codigo_tributario_municipio: CFG.codigoTributarioMunicipio || undefined,
        valor_servicos: Number(valor.toFixed(2)),
      },
    };
    const nfse = await emitFocus(ref, dpsBody);
    const st = String(nfse?.status ?? "processando");
    const pdfPath = (nfse?.caminho_danfse as string) || "";
    const xmlPath = (nfse?.caminho_xml_nota_fiscal as string) || "";
    const pdfUrl = pdfPath ? `${nfseBaseUrl()}${pdfPath}` : ((nfse?.url as string) || "");
    const xmlUrl = xmlPath ? `${nfseBaseUrl()}${xmlPath}` : "";

    // Atualiza o registro com o resultado.
    await supabase.from("nfse_invoices").update({
      status: st === "autorizado" ? "autorizado" : st === "erro_autorizacao" ? "erro_autorizacao" : st === "cancelado" ? "cancelado" : "processando",
      numero: (nfse?.numero as string) ?? null,
      codigo_verificacao: (nfse?.codigo_verificacao as string) ?? null,
      pdf_url: pdfUrl || null,
      xml_url: xmlUrl || null,
      error: st === "erro_autorizacao" ? JSON.stringify(nfse?.erros ?? nfse).slice(0, 500) : null,
      raw: nfse as never,
      updated_at: new Date().toISOString(),
    } as never).eq("ref", ref);

    const results: string[] = [`nfse: ${st}${pdfUrl ? " (pdf ok)" : ""}`];

    // Envia só quando autorizada (com link). "Processando" → o reprocessador cobre depois.
    // Claim atômico em sent_at: garante 1 envio único mesmo com reprocessamento concorrente.
    let shouldSend = false;
    if (st === "autorizado" && pdfUrl) {
      const { data: claim } = await supabase.from("nfse_invoices")
        .update({ sent_at: new Date().toISOString() } as never)
        .eq("ref", ref).is("sent_at", null).select("id");
      shouldSend = Array.isArray(claim) && claim.length > 0;
    }
    if (shouldSend) {
      const hdrs = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        "x-internal-secret": Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "",
      };
      if (patientEmail) {
        try {
          const r = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST", headers: hdrs,
            body: JSON.stringify({ type: "nfse_invoice", to: patientEmail, data: { patient_name: patientName, amount: amountBRL, nfse_url: pdfUrl, appointment_id: resourceId } }),
          });
          results.push(`email: ${r.ok ? "sent" : "failed"}`);
        } catch (e) { results.push(`email: error ${(e as Error).message}`); }
      }
      if (patient?.phone) {
        try {
          const msg = `🧾 *Nota Fiscal — AloClínica*\n\nOlá ${patientName}, a nota fiscal da sua consulta foi emitida.\n\nValor: *${amountBRL}*\n\n📄 Baixar a NFS-e:\n${pdfUrl}\n\n_Documento fiscal oficial. Guarde para reembolso junto ao seu plano de saúde._`;
          const r = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
            method: "POST", headers: hdrs,
            body: JSON.stringify({ phone: patient.phone, message: msg, user_id: patientId, category: "payment" }),
          });
          results.push(`whatsapp: ${r.ok ? "sent" : "failed"}`);
        } catch (e) { results.push(`whatsapp: error ${(e as Error).message}`); }
      }
    }

    return json({ success: true, status: st, pdf_url: pdfUrl || null, results });
  } catch (e) {
    console.error("[emit-nfse]", e);
    return json({ success: false, error: (e as Error).message });
  }
});
