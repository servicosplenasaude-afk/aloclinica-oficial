// ============================================================================
// Helper compartilhado do PagBank (PagSeguro) — Orders API.
// FUNDAÇÃO da migração de gateway (construída AO LADO do Mercado Pago; não
// substitui nada até ser testada no sandbox e a chave ser virada).
//
// Configuração via SECRETS do Supabase (NUNCA hardcoded):
//   PAGBANK_TOKEN  — token da conta (Bearer). Comece com o token de SANDBOX.
//   PAGBANK_ENV    — "sandbox" (default) ou "production".
//
// Docs: https://developer.pagbank.com.br/docs/apis-pagbank
// Webhook auth: https://developer.pagbank.com.br/reference/confirmar-autenticidade-da-notificacao
// ============================================================================

export function pagbankBaseUrl(): string {
  const env = (Deno.env.get("PAGBANK_ENV") ?? "sandbox").toLowerCase();
  return env === "production" || env === "producao"
    ? "https://api.pagseguro.com"
    : "https://sandbox.api.pagseguro.com";
}

export function pagbankToken(): string {
  return Deno.env.get("PAGBANK_TOKEN") ?? "";
}

export function pagbankConfigured(): boolean {
  return pagbankToken().length > 0;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${pagbankToken()}`,
    "Content-Type": "application/json",
    accept: "application/json",
  };
}

/** Cria um pedido (order) no PagBank. Retorna { ok, status, data }. */
export async function pagbankCreateOrder(
  order: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${pagbankBaseUrl()}/orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(order),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

/**
 * Monta o objeto `splits` (raiz do pedido) para repassar ao médico.
 * A plataforma (dona do token) fica com a comissão (PLATFORM_FEE_PERCENT) e o
 * médico recebe o resto. Precisa do Account ID da plataforma (PAGBANK_ACCOUNT_ID)
 * e do Account ID do médico (doctor_profiles.pagbank_account_id). Sem qualquer um
 * deles, retorna undefined → sem split (o valor fica com o dono do token).
 * Estrutura validada no sandbox: { method:"FIXED", receivers:[{account:{id},amount:{value}}] }.
 * A soma dos receivers = total.
 */
export function pagbankSplit(
  totalCents: number,
  doctorAccountId?: string | null,
): Record<string, unknown> | undefined {
  const platformAccount = Deno.env.get("PAGBANK_ACCOUNT_ID");
  if (!doctorAccountId || !platformAccount) return undefined;
  const feePct = Number(Deno.env.get("PLATFORM_FEE_PERCENT") ?? "0");
  const platformCents = Math.max(0, Math.min(totalCents, Math.round((totalCents * feePct) / 100)));
  const doctorCents = totalCents - platformCents;
  const receivers: Array<Record<string, unknown>> = [];
  if (platformCents > 0) receivers.push({ account: { id: platformAccount }, amount: { value: platformCents } });
  receivers.push({ account: { id: doctorAccountId }, amount: { value: doctorCents } });
  return { method: "FIXED", receivers };
}

/**
 * Valida a autenticidade do webhook do PagBank.
 * O header `x-authenticity-token` = SHA-256(hex) de `<token>-<corpo bruto>`.
 * IMPORTANTE: usar o corpo EXATAMENTE como recebido (não reserializar o JSON).
 * Comparação em tempo constante.
 */
export async function pagbankVerifyWebhook(
  rawBody: string,
  headerToken: string | null,
): Promise<boolean> {
  const token = pagbankToken();
  if (!token || !headerToken) return false;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${token}-${rawBody}`),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length !== headerToken.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ headerToken.charCodeAt(i);
  return diff === 0;
}
