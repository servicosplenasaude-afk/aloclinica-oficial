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
  // Padrão da NFS-e: "nacional" (endpoint /v2/nfsen, DPS — usado por Boa Vista/RR e
  // demais municípios no Ambiente Nacional) ou "municipal" (/v2/nfse). Default nacional.
  padrao: (Deno.env.get("NFSE_PADRAO") ?? "nacional").toLowerCase(),
  cnpj: (Deno.env.get("NFSE_CNPJ") ?? "").replace(/\D/g, ""),
  inscricaoMunicipal: Deno.env.get("NFSE_INSCRICAO_MUNICIPAL") ?? "",
  cityIbge: Deno.env.get("NFSE_CITY_IBGE") ?? "",
  itemListaServico: Deno.env.get("NFSE_ITEM_LISTA_SERVICO") ?? "",
  codigoTributarioMunicipio: Deno.env.get("NFSE_CODIGO_TRIBUTARIO_MUNICIPIO") ?? "",
  // Código de tributação nacional do serviço (padrão nacional). Ex.: teleconsulta.
  codigoTributacaoNacional: Deno.env.get("NFSE_CODIGO_TRIBUTACAO_NACIONAL") ?? "",
  issRate: Number(Deno.env.get("NFSE_ISS_RATE") ?? "0"),
  serviceDesc: Deno.env.get("NFSE_SERVICE_DESC") ?? "Teleconsulta médica (telemedicina) — prestação de serviço de saúde à distância.",
};
const isNacional = () => CFG.padrao === "nacional";
export const nfseBaseUrl = () => (CFG.ambiente === "producao" ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br");
// Endpoint da Focus por padrão: nacional → /v2/nfsen, municipal → /v2/nfse.
const nfseEndpoint = () => (isNacional() ? "nfsen" : "nfse");
// "Configurada" = tem credenciais + o código fiscal do padrão em uso.
const isConfigured = () => Boolean(
  CFG.token && CFG.cnpj && CFG.cityIbge &&
  (isNacional() ? CFG.codigoTributacaoNacional : CFG.itemListaServico),
);
const auth = (tok: string = CFG.token) => "Basic " + btoa(`${tok}:`);

async function emitFocus(ref: string, body: unknown, tok: string = CFG.token) {
  const ep = nfseEndpoint();
  const post = await fetch(`${nfseBaseUrl()}/v2/${ep}?ref=${encodeURIComponent(ref)}`, {
    method: "POST",
    headers: { Authorization: auth(tok), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const posted = await post.json().catch(() => ({}));
  if (post.status >= 400 && posted?.codigo !== "nfse_ja_existe") {
    throw new Error(`focus emit ${post.status}: ${JSON.stringify(posted).slice(0, 400)}`);
  }
  let last: Record<string, unknown> = posted;
  for (let i = 0; i < 6; i++) {
    const g = await fetch(`${nfseBaseUrl()}/v2/${ep}/${encodeURIComponent(ref)}`, { headers: { Authorization: auth(tok) } });
    last = await g.json().catch(() => ({}));
    const st = String(last?.status ?? "");
    if (st === "autorizado") return last;
    if (st === "erro_autorizacao" || st === "cancelado") return last;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return last; // ainda processando
}

// Monta o corpo da emissão conforme o padrão (nacional/DPS ou municipal).
function buildEmitBody(p: {
  valor: number; patientCpf: string; patientName: string; patientEmail: string;
  item: string; iss: number; im: string; ctm: string; desc: string; codNacional: string;
}): Record<string, unknown> {
  const cpf = p.patientCpf.replace(/\D/g, "") || undefined;
  if (isNacional()) {
    // Padrão NACIONAL (DPS) — endpoint /v2/nfsen. Estrutura PLANA (campos com prefixo).
    // Focus auto-numera série/número da DPS quando a empresa tem numeração automática.
    return {
      data_emissao: new Date().toISOString(),
      data_competencia: new Date().toISOString().slice(0, 10),
      codigo_municipio_emissora: CFG.cityIbge,
      // Prestador
      cnpj_prestador: CFG.cnpj,
      inscricao_municipal_prestador: p.im || undefined,
      // Tomador (pessoa física)
      cpf_tomador: cpf,
      razao_social_tomador: p.patientName,
      email_tomador: p.patientEmail || undefined,
      // Serviço
      codigo_municipio_prestacao: CFG.cityIbge,
      codigo_tributacao_nacional_iss: p.codNacional,
      descricao_servico: p.desc,
      // Valores
      valor_servico: Number(p.valor.toFixed(2)),
      tributacao_iss: 1, // 1 = operação tributável no município
    };
  }
  // Padrão MUNICIPAL — endpoint /v2/nfse.
  return {
    data_emissao: new Date().toISOString().slice(0, 19),
    prestador: { cnpj: CFG.cnpj, inscricao_municipal: p.im || undefined, codigo_municipio: CFG.cityIbge },
    tomador: { cpf, razao_social: p.patientName, email: p.patientEmail || undefined },
    servico: {
      aliquota: p.iss, discriminacao: p.desc, iss_retido: false,
      item_lista_servico: p.item,
      codigo_tributario_municipio: p.ctm || undefined,
      valor_servicos: Number(p.valor.toFixed(2)),
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!isInternalOrService(req)) return json({ error: "forbidden" }, 403);

  try {
    const body = await req.json().catch(() => ({}));

    // PING (não-destrutivo): verifica se o token autentica em determinado ambiente,
    // fazendo só um GET de uma NFS-e inexistente. 401 = token inválido; 404 = token OK.
    if (body.ping === true) {
      const amb = String(body.ambiente ?? CFG.ambiente).toLowerCase();
      const host = amb === "producao" ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";
      const pingTok = body.token ? String(body.token) : CFG.token;
      if (!pingTok) return json({ ping: true, ok: false, reason: "FOCUS_NFE_TOKEN não configurado" });
      const g = await fetch(`${host}/v2/${nfseEndpoint()}/ping_auth_check_naoexiste`, { headers: { Authorization: auth(pingTok) } });
      const txt = await g.text().catch(() => "");
      return json({ ping: true, ambiente: amb, host, status: g.status, authenticated: g.status !== 401, body: txt.slice(0, 250) });
    }

    const isTest = body.test === true;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Dados resolvidos (modo normal OU modo de teste).
    let resourceType: string;
    let resourceId: string | null;
    let ref: string;
    let patientId: string | null = null;
    let valor = 0;
    let patientCpf = "";
    let patientPhone = "";
    let patientEmail = "";
    let patientName = "Paciente";
    // Dados fiscais — do CFG por padrão; sobrescrevíveis inline SÓ no modo de teste.
    let fiscItem = CFG.itemListaServico;
    let fiscIss = CFG.issRate;
    let fiscIM = CFG.inscricaoMunicipal;
    let fiscCTM = CFG.codigoTributarioMunicipio;
    let fiscDesc = CFG.serviceDesc;
    let fiscCodNacional = CFG.codigoTributacaoNacional;

    if (isTest) {
      // Emissão de TESTE (homologação/sandbox — SEM valor fiscal). Usa dados inline,
      // não toca em appointments/on_demand_queue e não exige os NFSE_* completos.
      if (CFG.ambiente === "producao") return json({ error: "modo de teste bloqueado em produção" }, 400);
      if (!(CFG.token && CFG.cnpj && CFG.cityIbge)) {
        return json({ skipped: true, reason: "faltam FOCUS_NFE_TOKEN / NFSE_CNPJ / NFSE_CITY_IBGE" });
      }
      resourceType = "test";
      resourceId = null;
      ref = String(body.ref || `test_${Date.now()}`);
      valor = Number(body.valor ?? 1);
      patientCpf = String(body.patient_cpf ?? "");
      patientPhone = String(body.patient_phone ?? "");
      patientEmail = String(body.patient_email ?? "");
      patientName = String(body.patient_name ?? "Paciente Teste");
      if (body.item_lista_servico) fiscItem = String(body.item_lista_servico);
      if (body.iss_rate != null) fiscIss = Number(body.iss_rate);
      if (body.inscricao_municipal) fiscIM = String(body.inscricao_municipal);
      if (body.codigo_tributario_municipio) fiscCTM = String(body.codigo_tributario_municipio);
      if (body.codigo_tributacao_nacional) fiscCodNacional = String(body.codigo_tributacao_nacional);
      if (body.service_desc) fiscDesc = String(body.service_desc);
    } else {
      // Modo normal: resolve o recurso (consulta agendada OU plantão) do banco.
      resourceType = body.appointment_id ? "appointment" : String(body.resource_type ?? "");
      resourceId = body.appointment_id ? String(body.appointment_id) : String(body.resource_id ?? "");
      if (!["appointment", "queue"].includes(resourceType) || !resourceId) {
        return json({ error: "resource_type (appointment|queue) + resource_id obrigatórios" }, 400);
      }
      ref = `${resourceType}_${resourceId}`;
      if (!isConfigured()) {
        return json({ skipped: true, reason: "NFS-e não configurada (defina FOCUS_NFE_TOKEN e NFSE_*)" });
      }

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
      if (patientId) {
        const { data: au } = await supabase.auth.admin.getUserById(patientId);
        patientEmail = au?.user?.email ?? "";
      }
      patientCpf = patient?.cpf ?? "";
      patientPhone = patient?.phone ?? "";
      patientName = patient ? `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() : "Paciente";
    }

    const amountBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

    // Registro inicial (processando) — idempotente por ref.
    await supabase.from("nfse_invoices").upsert({
      ref, resource_type: resourceType, resource_id: resourceId, patient_id: patientId, valor,
      status: "processando", provider: "focusnfe", updated_at: new Date().toISOString(),
    } as never, { onConflict: "ref" });

    // Emite via Focus — corpo conforme o padrão (nacional/DPS ou municipal).
    const dpsBody = buildEmitBody({
      valor, patientCpf, patientName, patientEmail,
      item: fiscItem, iss: fiscIss, im: fiscIM, ctm: fiscCTM, desc: fiscDesc, codNacional: fiscCodNacional,
    });
    // Token efetivo: no modo de teste aceita override inline (ex.: token de homologação);
    // caso contrário usa o secret FOCUS_NFE_TOKEN.
    const effToken = isTest && body.token ? String(body.token) : CFG.token;
    const nfse = await emitFocus(ref, dpsBody, effToken);
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
            body: JSON.stringify({ type: "nfse_invoice", to: patientEmail, data: { patient_name: patientName, amount: amountBRL, nfse_url: pdfUrl, appointment_id: resourceId ?? ref } }),
          });
          results.push(`email: ${r.ok ? "sent" : "failed"}`);
        } catch (e) { results.push(`email: error ${(e as Error).message}`); }
      }
      if (patientPhone) {
        try {
          const msg = `🧾 *Nota Fiscal — AloClínica*\n\nOlá ${patientName}, a nota fiscal da sua consulta foi emitida.\n\nValor: *${amountBRL}*\n\n📄 Baixar a NFS-e:\n${pdfUrl}\n\n_Documento fiscal oficial. Guarde para reembolso junto ao seu plano de saúde._`;
          const r = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
            method: "POST", headers: hdrs,
            body: JSON.stringify({ phone: patientPhone, message: msg, user_id: patientId, category: "payment" }),
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
