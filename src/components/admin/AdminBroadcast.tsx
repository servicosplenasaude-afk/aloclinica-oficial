import { useState, useEffect, useRef } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getAdminNav } from "./adminNav";
import { AdminPageHeader } from "./AdminPageHeader";
import { Megaphone, Send, Users as UsersIcon, Bell } from "lucide-react";
import { logError } from "@/lib/logger";
// UI: accessible confirm dialog (replaces native window.confirm)
import { useConfirm } from "@/components/ui/confirm-dialog";

type Audience = "all" | "patient" | "doctor" | "clinic" | "subscribers";

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "Todos os usuários",
  patient: "Apenas pacientes",
  doctor: "Apenas médicos",
  clinic: "Apenas clínicas",
  subscribers: "Quem tem push ativado",
};

const AdminBroadcast = () => {
  const confirm = useConfirm();
  const [audience, setAudience] = useState<Audience>("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [counts, setCounts] = useState<Record<Audience, number>>({ all: 0, patient: 0, doctor: 0, clinic: 0, subscribers: 0 });
  const [lastResult, setLastResult] = useState<{ sent: number; excluded: number } | null>(null);
  const [previewOnly, setPreviewOnly] = useState(true);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => { void loadCounts(); }, []);

  const loadCounts = async () => {
    const [profilesRes, rolesRes, subsRes] = await Promise.all([
      db.from("profiles").select("user_id", { count: "exact", head: true }),
      db.from("user_roles").select("user_id, role"),
      db.from("push_subscriptions").select("user_id", { count: "exact", head: true }),
    ]);
    const roleCount = (role: string) =>
      new Set((rolesRes.data ?? []).filter(r => r.role === role).map(r => r.user_id)).size;
    setCounts({
      all: profilesRes.count ?? 0,
      patient: roleCount("patient"),
      doctor: roleCount("doctor"),
      clinic: roleCount("clinic"),
      subscribers: subsRes.count ?? 0,
    });
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }
    if (link.trim() && (!link.trim().startsWith("/") || link.trim().startsWith("//"))) {
      toast.error("Use apenas links internos", { description: "Exemplo: /dashboard/appointments" });
      return;
    }
    const { data: preview, error: previewError } = await db.functions.invoke("admin-broadcast", {
      body: { audience, dry_run: true },
    });
    if (previewError) {
      toast.error("Não foi possível validar a audiência");
      return;
    }
    if (!preview?.eligible) {
      toast.error("Audiência vazia", { description: "Nenhum usuário se encaixa no filtro." });
      return;
    }
    if (previewOnly) {
      setLastResult({ sent: preview.eligible, excluded: preview.opted_out ?? 0 });
      toast.success(`Prévia validada: ${preview.eligible} destinatário(s) elegíveis`);
      return;
    }
    const ok = await confirm({
      title: "Enviar broadcast?",
      description: `A notificação será gravada para ${preview.eligible} usuário(s); ${preview.opted_out ?? 0} opt-out(s) serão respeitados. Esta ação não pode ser desfeita.`,
      confirmLabel: "Enviar",
    });
    if (!ok) return;

    setSending(true);
    setLastResult(null);
    try {
      const { data, error } = await db.functions.invoke("admin-broadcast", {
        body: { audience, title: title.trim(), message: message.trim(), link: link.trim() || undefined, dry_run: false, idempotency_key: idempotencyKey.current },
      });
      if (error || !data?.success) throw error ?? new Error(data?.error || "Falha no broadcast");
      setLastResult({ sent: data.inserted ?? 0, excluded: data.opted_out ?? 0 });
      toast.success(`Broadcast enviado para ${data.inserted ?? 0} usuário(s)`);
      setTitle("");
      setMessage("");
      setLink("");
      idempotencyKey.current = crypto.randomUUID();
    } catch (err) {
      logError("AdminBroadcast send failed", err);
      const status = (err as { context?: { status?: number } })?.context?.status;
      const description = status === 403
        ? "Por segurança, entre novamente na conta antes de realizar um envio em massa."
        : status === 429
        ? "Limite de envios atingido. Aguarde antes de tentar novamente."
        : "O envio não foi realizado. Você pode tentar novamente com a mesma chave segura.";
      toast.error("Erro ao enviar broadcast", { description });
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout title="Administração" nav={getAdminNav("broadcast")}>
      <div className="w-full mx-auto max-w-3xl space-y-5 pb-24 md:pb-6">
        <AdminPageHeader
          icon={Megaphone}
          eyebrow="Comunicação"
          title="Broadcast"
          description="Valide a audiência e publique notificações in-app com opt-out e auditoria."
          accent="from-amber-500 to-orange-600"
        />

        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Audiência</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(AUDIENCE_LABELS) as Audience[]).map(a => (
                    <SelectItem key={a} value={a}>
                      {AUDIENCE_LABELS[a]} <span className="text-muted-foreground ml-1">({counts[a]})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
                <UsersIcon className="w-3 h-3" /> {counts[audience]} usuário{counts[audience] === 1 ? "" : "s"} no escopo
                {audience !== "subscribers" && (
                  <span className="text-muted-foreground/70">— push chegará apenas para os que ativaram</span>
                )}
              </p>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Título *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Manutenção programada"
                maxLength={120}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mensagem *</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Texto que aparecerá pro usuário"
                maxLength={500}
                rows={4}
                className="mt-1.5"
              />
              <p className="text-[11px] text-muted-foreground mt-1">{message.length}/500</p>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Link (opcional)</Label>
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/dashboard/appointments"
                className="mt-1.5 font-mono text-sm"
              />
            </div>

            {/* Preview */}
            {(title || message) && (
              <div className="rounded-xl border border-border/40 bg-muted/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Preview</p>
                <div className="flex items-start gap-3 bg-card border border-border/40 rounded-lg p-3 shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{title || "Título"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{message || "Sua mensagem aparecerá aqui."}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={previewOnly} onChange={(event) => setPreviewOnly(event.target.checked)} />
                Somente prévia (não envia)
              </label>
              {lastResult ? (
                <Badge variant="outline" className="text-xs">
                  {previewOnly ? `Prévia: ${lastResult.sent} elegível(is) · ${lastResult.excluded} opt-out(s)` : `Último envio: ${lastResult.sent} entregue(s)`}
                </Badge>
              ) : <span />}
              <Button onClick={handleSend} disabled={sending || !title.trim() || !message.trim()} className="gap-2">
                <Send className="w-4 h-4" />
                {sending ? "Processando..." : previewOnly ? "Validar prévia" : `Enviar para até ${counts[audience]}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminBroadcast;
