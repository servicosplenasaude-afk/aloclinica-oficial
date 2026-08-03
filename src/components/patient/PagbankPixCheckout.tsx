// Checkout PIX do PagBank (Fase 2) — componente AUTOCONTIDO.
// Ainda NÃO está no fluxo real de agendamento (o Mercado Pago segue ativo).
// Gera a cobrança via edge function, mostra o QR + copia-e-cola, conta o tempo
// de expiração e detecta a confirmação do pagamento por polling do status.
//
// Uso futuro (Fase 6): <PagbankPixCheckout appointmentId={id} onPaid={...} />
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import { createPagbankPix, type PagbankPixResult } from "@/lib/pagbank";
import { Button } from "@/components/ui/button";
import { Copy, Check, QrCode, Loader2, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

type State = "idle" | "creating" | "awaiting" | "paid" | "error";
const PAID = ["approved", "confirmed", "paid", "received", "available"];

export function PagbankPixCheckout({
  appointmentId,
  onPaid,
  autoStart = true,
}: {
  appointmentId: string;
  onPaid?: () => void;
  autoStart?: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const [pix, setPix] = useState<PagbankPixResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const started = useRef(false);

  const start = useCallback(async () => {
    setState("creating");
    setError(null);
    const res = await createPagbankPix(appointmentId);
    if (!res.success || !res.pix_copy_paste) {
      setError(res.error || "Não foi possível gerar o PIX. Tente novamente.");
      setState("error");
      return;
    }
    setPix(res);
    setState("awaiting");
  }, [appointmentId]);

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void start();
    }
  }, [autoStart, start]);

  // Polling do status do pagamento enquanto aguarda.
  useEffect(() => {
    if (state !== "awaiting") return;
    const id = setInterval(async () => {
      const { data } = await db
        .from("appointments")
        .select("payment_status")
        .eq("id", appointmentId)
        .single();
      if (data && PAID.includes(String(data.payment_status).toLowerCase())) {
        setState("paid");
        onPaid?.();
      }
    }, 4000);
    return () => clearInterval(id);
  }, [state, appointmentId, onPaid]);

  // Contagem regressiva de expiração do QR.
  useEffect(() => {
    if (!pix?.expires_at) return;
    const target = new Date(pix.expires_at).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pix?.expires_at]);

  const copy = () => {
    if (!pix?.pix_copy_paste) return;
    navigator.clipboard.writeText(pix.pix_copy_paste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mmss =
    secondsLeft != null
      ? `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`
      : null;

  if (state === "creating" || state === "idle") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm">Gerando o PIX…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
        <Button variant="outline" onClick={start}>Tentar novamente</Button>
      </div>
    );
  }

  if (state === "paid") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <p className="font-bold text-foreground">Pagamento confirmado!</p>
        <p className="text-sm text-muted-foreground">Sua consulta está garantida.</p>
      </div>
    );
  }

  // awaiting
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
        <QrCode className="w-4 h-4" /> Pague com PIX pra confirmar
      </div>

      {pix?.pix_qr_image && (
        <img
          src={pix.pix_qr_image}
          alt="QR Code do PIX"
          className="w-52 h-52 rounded-2xl border border-border bg-white p-2"
        />
      )}

      <div className="w-full max-w-sm">
        <p className="text-[11px] text-muted-foreground mb-1 text-center">PIX copia e cola</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[11px] bg-muted rounded-lg px-3 py-2 truncate">
            {pix?.pix_copy_paste}
          </code>
          <Button size="icon" variant="outline" onClick={copy} aria-label="Copiar código PIX">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {mmss && (
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" /> Expira em <strong className="text-foreground tabular-nums">{mmss}</strong>
        </div>
      )}

      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Aguardando o pagamento…
      </div>
    </div>
  );
}

export default PagbankPixCheckout;
