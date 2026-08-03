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
