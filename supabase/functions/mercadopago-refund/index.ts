/**
 * mercadopago-refund
 *
 * Estorno (total ou parcial) de um pagamento Mercado Pago.
 *
 * Body:
 *   {
 *     transaction_id?: string,    // UUID em payment_transactions
 *     mp_payment_id?: string,     // alternativa: ID direto no MP
 *     amount?: number             // se omitido, estorno total
 *   }
 *
 * Permissão: admin OU dono da transação dentro de 24h
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mpRequest, mpCorsHeaders } from "../_shared/mercadopago.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: mpCorsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { transaction_id, mp_payment_id, reference_id, amount } = await req.json();

    if (!transaction_id && !mp_payment_id && !reference_id) {
      return json({ error: "transaction_id, mp_payment_id ou reference_id obrigatório" }, 400);
    }

    // Resolve transação. Por id direto (transaction_id/mp_payment_id) ou, quando o
    // chamador só conhece o recurso, por reference_id ("appointment_<id>"/"queue_<id>")
    // → pega a transação mais recente daquele recurso.
    let tx: any = null;
    if (transaction_id || mp_payment_id) {
      let txQuery = admin.from("payment_transactions").select("*");
      txQuery = transaction_id ? txQuery.eq("id", transaction_id) : txQuery.eq("mp_payment_id", mp_payment_id);
      tx = (await txQuery.maybeSingle()).data;
    } else {
      const i = String(reference_id).indexOf("_");
      const rtype = i > 0 ? String(reference_id).slice(0, i) : "";
      const rid = i > 0 ? String(reference_id).slice(i + 1) : "";
      if (!rtype || !rid) return json({ error: "reference_id inválido" }, 400);
      const { data } = await admin
        .from("payment_transactions").select("*")
        .eq("resource_type", rtype).eq("resource_id", rid)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      tx = data;
    }

    if (!tx) return json({ error: "Transação não encontrada" }, 404);

    // Permissão: admin ou owner dentro de 24h
    const isOwner = tx.user_id === user.id;
    if (!isOwner) {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      if (!isAdmin) return json({ error: "Sem permissão" }, 403);
    } else {
      // Owner só pode estornar dentro de 24h. Fallback para created_at quando
      // paid_at é nulo (transações antigas / aprovação imediata sem webhook),
      // senão um reembolso legítimo seria bloqueado por hoursSince = Infinity.
      const refAt = tx.paid_at ?? tx.created_at ?? null;
      const paidAt = refAt ? new Date(refAt).getTime() : 0;
      const hoursSince = paidAt ? (Date.now() - paidAt) / 3_600_000 : Infinity;
      if (hoursSince > 24) {
        return json({ error: "Refund só disponível em até 24h após pagamento. Entre em contato com o suporte." }, 403);
      }
    }

    if (!tx.mp_payment_id) {
      return json({ error: "Transação não tem mp_payment_id — possivelmente transação legacy" }, 400);
    }

    // SECURITY: block if already refunded (normalize legacy status spellings).
    const REFUND_TERMINAL = new Set(["refunded", "partially_refunded", "partial_refund", "refunding"]);
    if (REFUND_TERMINAL.has(String(tx.status))) return json({ error: "Já estornado ou em processamento" }, 400);

    const refundableStatuses = new Set(["paid", "approved", "confirmed", "received"]);
    if (!refundableStatuses.has(String(tx.status))) {
      return json({ error: "Transação não está em estado reembolsável" }, 409);
    }
    const requestedCents = amount == null ? null : Math.round(Number(amount) * 100);
    if (requestedCents !== null && (!Number.isSafeInteger(requestedCents) || requestedCents <= 0 || requestedCents > Number(tx.amount_cents))) {
      return json({ error: "Valor de estorno inválido" }, 400);
    }
    const isPartial = requestedCents !== null && requestedCents < Number(tx.amount_cents);

    // SECURITY: atomically CLAIM the transaction before calling MP. Only one
    // concurrent request can flip a non-refunded row to 'refunding', so a
    // double-submit / retry cannot trigger a second real refund at the gateway.
    const { data: claimed } = await admin
      .from("payment_transactions")
      .update({ status: "refunding" } as any)
      .eq("mp_payment_id", tx.mp_payment_id)
      .not("status", "in", "(refunded,partially_refunded,partial_refund,refunding)")
      .select("id");

    if (!claimed || claimed.length === 0) {
      return json({ error: "Estorno já em andamento ou concluído" }, 409);
    }

    // Cria refund. SECURITY: stable idempotency key derived from the MP payment id
    // (+ amount for partial) — never Date.now() — so gateway retries are deduped.
    const refundBody: Record<string, any> = {};
    if (isPartial) refundBody.amount = requestedCents! / 100;
    const idempotencyKey = isPartial
      ? `refund-${tx.mp_payment_id}-${requestedCents}`
      : `refund-${tx.mp_payment_id}-full`;

    const refund = await mpRequest<any>(
      "POST",
      `/v1/payments/${tx.mp_payment_id}/refunds`,
      isPartial ? refundBody : undefined,
      { idempotencyKey }
    );

    if (!refund.ok) {
      // SECURITY: release the claim so a legitimate retry can proceed.
      await admin
        .from("payment_transactions")
        .update({ status: tx.status } as any)
        .eq("id", tx.id);
      return json({
        error: refund.data?.message || refund.data?.cause?.[0]?.description || "Falha no refund",
        gateway: refund.data,
      }, 400);
    }

    await admin
      .from("payment_transactions")
      .update({
        status: isPartial ? "partially_refunded" : "refunded",
        refunded_at: new Date().toISOString(),
        raw_response: { ...tx.raw_response, refund: refund.data },
      } as any)
      .eq("id", tx.id);

    // MONEY-INTEGRITY: num estorno TOTAL, cancela o repasse do médico ainda não
    // sacado — senão a plataforma devolve ao paciente E paga o médico (both sides).
    // Repasse 'pending'/'ready' sem withdrawal_id → cancela. Se já foi sacado
    // (withdrawal_id preenchido / status 'paid'), não dá pra estornar aqui: sinaliza.
    let payoutClawback: "cancelled" | "already_withdrawn" | "none" = "none";
    if (tx.resource_type === "appointment" && tx.resource_id && !isPartial) {
      const { data: payouts } = await admin
        .from("doctor_payouts")
        .select("id, status, withdrawal_id")
        .eq("appointment_id", tx.resource_id);
      const list = (payouts ?? []) as Array<{ id: string; status: string; withdrawal_id: string | null }>;
      const cancellable = list.filter((p) => !p.withdrawal_id && ["pending", "ready"].includes(p.status));
      const locked = list.filter((p) => p.withdrawal_id || ["paid", "processing"].includes(p.status));
      if (cancellable.length) {
        await admin
          .from("doctor_payouts")
          .update({ status: "cancelled", notes: "Cancelado por estorno do pagamento", updated_at: new Date().toISOString() } as any)
          .in("id", cancellable.map((p) => p.id));
        payoutClawback = "cancelled";
      }
      if (locked.length) payoutClawback = "already_withdrawn";
    }

    // Atualiza recurso relacionado
    if (tx.resource_type === "appointment" && tx.resource_id) {
      await admin
        .from("appointments")
        .update({ payment_status: isPartial ? "partially_refunded" : "refunded" } as any)
        .eq("id", tx.resource_id);
    } else if (tx.resource_type === "queue" && tx.resource_id && !isPartial) {
      // Estorno de plantão/urgência: tira o paciente da fila e marca a entrada.
      await admin
        .from("on_demand_queue")
        .update({ status: "refunded", completed_at: new Date().toISOString() } as any)
        .eq("id", tx.resource_id);
    }

    return json({
      ok: true,
      refund_id: String(refund.data.id),
      amount: refund.data.amount,
      is_partial: isPartial,
      payout_clawback: payoutClawback,
    });
  } catch (e) {
    console.error("[mp-refund] error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...mpCorsHeaders, "Content-Type": "application/json" },
  });
}
