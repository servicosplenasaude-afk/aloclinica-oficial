import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ScrollText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchActiveLegalDoc, recordConsultationConsent, type LegalKind, type LegalDoc } from "@/lib/legal-docs";
import { LegalMarkdown } from "@/components/ui/legal-markdown";

/**
 * Dialog reusável que carrega o documento legal vigente do `kind`, exige
 * leitura (scroll até o fim) + checkbox + clique. Em sucesso registra o
 * aceite imutável e chama `onAccepted`.
 */
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: LegalKind;
  appointmentId?: string | null;
  onAccepted: () => void;
  /** Texto do botão de confirmação */
  acceptLabel?: string;
}

export function ConsentDialog({ open, onOpenChange, kind, appointmentId, onAccepted, acceptLabel = "Li e aceito" }: Props) {
  const { user } = useAuth();
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Se o documento é curto e NÃO rola, o evento de scroll nunca dispara e o aceite
  // ficaria travado para sempre. Detecta a ausência de overflow e libera o aceite.
  useEffect(() => {
    if (loading || !doc) return;
    const t = setTimeout(() => {
      const vp = scrollAreaRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
      if (vp && vp.scrollHeight - vp.clientHeight < 40) setReachedEnd(true);
    }, 200);
    return () => clearTimeout(t);
  }, [loading, doc]);

  useEffect(() => {
    if (!open) return;
    setAccepted(false); setReachedEnd(false);
    setLoading(true);
    fetchActiveLegalDoc(kind)
      .then((d) => setDoc(d))
      .finally(() => setLoading(false));
  }, [open, kind]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) setReachedEnd(true);
  };

  const submit = async () => {
    if (!user || !doc) return;
    setSubmitting(true);
    try {
      await recordConsultationConsent({ userId: user.id, doc, appointmentId });
      onOpenChange(false);
      onAccepted();
    } catch (e: any) {
      toast.error("Não foi possível registrar o aceite", { description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            {doc?.title ?? "Termo de Consentimento"}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            Versão {doc?.version ?? "—"} · Vigente desde {doc ? new Date(doc.effective_at).toLocaleDateString("pt-BR") : "—"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : doc ? (
          <ScrollArea ref={scrollAreaRef} className="h-[55vh] rounded-lg border border-border bg-muted/30 p-4" onScrollCapture={onScroll}>
            <LegalMarkdown source={doc.body_md} />
          </ScrollArea>
        ) : (
          <p className="text-sm text-destructive py-8 text-center">Documento indisponível. Tente novamente.</p>
        )}

        <div className="flex items-start gap-2 mt-2">
          <Checkbox
            id="legal-accept"
            checked={accepted}
            disabled={!reachedEnd || !doc}
            onCheckedChange={(v) => setAccepted(v === true)}
          />
          <label htmlFor="legal-accept" className="text-sm text-foreground leading-snug select-none">
            Declaro que li, compreendi e <strong>aceito integralmente</strong> o conteúdo acima.
            {!reachedEnd && doc && <span className="block text-[11px] text-muted-foreground mt-0.5">Role o texto até o final para liberar o aceite.</span>}
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={submit} disabled={!accepted || submitting || !doc} className="gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {acceptLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConsentDialog;