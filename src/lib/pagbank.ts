// Cliente do PagBank (frontend) — Fase 2 da migração de gateway.
// Chama as edge functions da fundação (pagbank-create-payment). Ainda NÃO está
// ligado ao checkout real — o Mercado Pago segue ativo até a virada (Fase 6).
import { db } from "@/integrations/supabase/untyped";

export interface PagbankPixResult {
  success: boolean;
  order_id?: string;
  pix_copy_paste?: string | null;
  pix_qr_image?: string | null;
  expires_at?: string | null;
  error?: string;
  details?: unknown;
}

/**
 * Cria uma cobrança PIX no PagBank para uma consulta.
 * Requer que o secret PAGBANK_TOKEN esteja configurado no Supabase (sandbox).
 */
export async function createPagbankPix(appointmentId: string): Promise<PagbankPixResult> {
  const { data, error } = await db.functions.invoke("pagbank-create-payment", {
    body: { appointment_id: appointmentId },
  });
  if (error) return { success: false, error: error.message };
  return data as PagbankPixResult;
}

// ── Cartão ──────────────────────────────────────────────────────────────────

type PagSeguroSdk = {
  encryptCard: (opts: {
    publicKey: string; holder: string; number: string;
    expMonth: string; expYear: string; securityCode: string;
  }) => { encryptedCard: string; hasErrors: boolean; errors?: unknown[] };
};

const SDK_URL = "https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js";
let sdkPromise: Promise<PagSeguroSdk> | null = null;

function loadPagbankSdk(): Promise<PagSeguroSdk> {
  const w = window as unknown as { PagSeguro?: PagSeguroSdk };
  if (w.PagSeguro) return Promise.resolve(w.PagSeguro);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => {
      const sdk = (window as unknown as { PagSeguro?: PagSeguroSdk }).PagSeguro;
      sdk ? resolve(sdk) : reject(new Error("SDK do PagBank carregou sem PagSeguro"));
    };
    s.onerror = () => reject(new Error("Falha ao carregar o SDK do PagBank"));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

/**
 * Criptografa os dados do cartão NO NAVEGADOR (RSA, chave pública do PagBank).
 * O número/CVV nunca trafega em texto puro para o nosso servidor.
 */
export async function encryptCardPagbank(card: {
  holder: string; number: string; expMonth: string; expYear: string; cvv: string;
}): Promise<string> {
  const sdk = await loadPagbankSdk();
  const { data, error } = await db.functions.invoke("pagbank-public-key");
  if (error || !(data as { public_key?: string })?.public_key) {
    throw new Error("Não foi possível obter a chave do PagBank.");
  }
  const result = sdk.encryptCard({
    publicKey: (data as { public_key: string }).public_key,
    holder: card.holder,
    number: card.number.replace(/\s/g, ""),
    expMonth: card.expMonth,
    expYear: card.expYear,
    securityCode: card.cvv,
  });
  if (result.hasErrors || !result.encryptedCard) {
    throw new Error("Dados do cartão inválidos. Confira e tente de novo.");
  }
  return result.encryptedCard;
}

export interface PagbankCardResult {
  success: boolean;
  status?: string;
  paid?: boolean;
  order_id?: string;
  error?: string;
}

/** Cobra a consulta no cartão (cifra no navegador e envia só o blob cifrado). */
export async function chargePagbankCard(
  appointmentId: string,
  card: { holder: string; number: string; expMonth: string; expYear: string; cvv: string },
  installments = 1,
): Promise<PagbankCardResult> {
  try {
    const encrypted_card = await encryptCardPagbank(card);
    const { data, error } = await db.functions.invoke("pagbank-charge-card", {
      body: { appointment_id: appointmentId, encrypted_card, installments },
    });
    if (error) return { success: false, error: error.message };
    return data as PagbankCardResult;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro no cartão" };
  }
}
