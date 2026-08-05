/**
 * AdminKycReview — fila de revisão manual de KYC.
 *
 * Mostra:
 *  - Verificações pendentes (status='pending') — admin pode aprovar ou rejeitar manualmente
 *  - Verificações reprovadas pela IA com similaridade alta (≥70%) — falsos negativos potenciais
 *  - Verificações aprovadas com similaridade limítrofe (80-89%) — auditoria
 *
 * Ações:
 *  - Aprovar: muda status para 'approved' + envia email kyc_approved
 *  - Rejeitar: muda status para 'rejected' + envia email kyc_rejected
 */
import { useEffect, useMemo, useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getAdminNav } from "./adminNav";
import { AdminPageHeader } from "./AdminPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShieldCheck, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, Camera,
} from "lucide-react";
import { warn } from "@/lib/logger";

type KycRow = {
  id: string;
  user_id: string;
  status: string;
  similarity: number | null;
  tipo: string;
  created_at: string;
  // joined
  user_email?: string;
  first_name?: string;
  last_name?: string;
};

const adminNav = getAdminNav("kyc-review");

const AdminKycReview = () => {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "review" | "approved" | "rejected">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; row: KycRow | null; reason: string }>({
    open: false, row: null, reason: "",
  });

  const fetchAll = async () => {
    setLoading(true);
    const { data: kyc, error } = await (db as any)
      .from("kyc_verificacoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast.error("Erro ao carregar verificações", { description: error.message });
      setLoading(false);
      return;
    }

    // Enrich com profile/email
    const userIds = [...new Set((kyc ?? []).map((k: KycRow) => k.user_id))];
    const { data: profiles } = await db
      .from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", userIds);

    const pMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    const enriched: KycRow[] = (kyc ?? []).map((k: KycRow) => ({
      ...k,
      first_name: (pMap.get(k.user_id) as any)?.first_name ?? "",
      last_name: (pMap.get(k.user_id) as any)?.last_name ?? "",
    }));

    setRows(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // SLA: pendente >24h é urgente (mostrar primeiro + badge vermelho)
  const ageHours = (createdAt: string) => (Date.now() - new Date(createdAt).getTime()) / 3600000;
  const SLA_HOURS = 24;

  const filtered = useMemo(() => {
    const list = rows.filter(r => {
      const sim = (r.similarity ?? 0) * 100;
      switch (tab) {
        case "pending":
          return r.status === "pending" || r.status === "pendente";
        case "review":
          if ((r.status === "rejected" || r.status === "reprovado") && sim >= 70) return true;
          if ((r.status === "approved" || r.status === "aprovado") && sim >= 80 && sim < 90) return true;
          return false;
        case "approved":
          return r.status === "approved" || r.status === "aprovado";
        case "rejected":
          return r.status === "rejected" || r.status === "reprovado";
      }
    });
    // Pendentes: ordena por idade (mais antigos primeiro — fora de SLA prioritário)
    if (tab === "pending") {
      return list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    }
    return list;
  }, [rows, tab]);

  const counts = useMemo(() => {
    const isPending = (r: KycRow) => r.status === "pending" || r.status === "pendente";
    const overduePending = rows.filter(r => isPending(r) && ageHours(r.created_at) > SLA_HOURS).length;
    return {
      pending: rows.filter(isPending).length,
      overduePending,
      review: rows.filter(r => {
        const sim = (r.similarity ?? 0) * 100;
        if ((r.status === "rejected" || r.status === "reprovado") && sim >= 70) return true;
        if ((r.status === "approved" || r.status === "aprovado") && sim >= 80 && sim < 90) return true;
        return false;
      }).length,
      approved: rows.filter(r => r.status === "approved" || r.status === "aprovado").length,
      rejected: rows.filter(r => r.status === "rejected" || r.status === "reprovado").length,
    };
  }, [rows]);

  const sendNotification = async (row: KycRow, approved: boolean, reason?: string) => {
    try {
      // Buscar email do user via edge function server-side (a Admin API não roda no navegador).
      const { data: lookup } = await db.functions.invoke("admin-user-lookup", { body: { user_id: row.user_id } });
      const email = (lookup as any)?.email;
      if (!email) {
        warn("[AdminKycReview] sem email para notificar", row.user_id);
        return;
      }
      await db.functions.invoke("send-email", {
        body: {
          type: approved ? "kyc_approved" : "kyc_rejected",
          to: email,
          data: {
            name: `${row.first_name} ${row.last_name}`.trim(),
            score: Math.round((row.similarity ?? 0) * 100),
            reason: reason || undefined,
          },
        },
      });
    } catch (e) {
      warn("[AdminKycReview] notificação falhou", e);
    }
  };

  const approve = async (row: KycRow) => {
    setActionLoading(row.id);
    const { error } = await (db as any)
      .from("kyc_verificacoes")
      .update({ status: "approved" })
      .eq("id", row.id);
    if (error) {
      toast.error("Erro ao aprovar", { description: error.message });
      setActionLoading(null);
      return;
    }
    // Médico: refletir em doctor_profiles
    if (row.tipo === "medico") {
      await db
        .from("doctor_profiles")
        .update({
          kyc_status: "approved",
          kyc_verified_at: new Date().toISOString(),
          kyc_face_match_score: Math.round((row.similarity ?? 0) * 100),
        } as any)
        .eq("user_id", row.user_id);
    }
    await sendNotification(row, true);
    toast.success("Aprovado!", { description: "Usuário foi notificado por email." });
    setActionLoading(null);
    await fetchAll();
  };

  const openReject = (row: KycRow) => setRejectDialog({ open: true, row, reason: "" });

  const confirmReject = async () => {
    const { row, reason } = rejectDialog;
    if (!row) return;
    setActionLoading(row.id);
    const { error } = await (db as any)
      .from("kyc_verificacoes")
      // Persiste o motivo no campo livre existente (error_message) — sem migration.
      .update({ status: "rejected", error_message: reason || null })
      .eq("id", row.id);
    if (error) {
      toast.error("Erro ao rejeitar", { description: error.message });
      setActionLoading(null);
      return;
    }
    if (row.tipo === "medico") {
      await db
        .from("doctor_profiles")
        .update({ kyc_status: "rejected" } as any)
        .eq("user_id", row.user_id);
    }
    await sendNotification(row, false, reason);
    toast.success("Rejeitado", { description: reason ? `Motivo: ${reason}` : "Usuário notificado por email." });
    setActionLoading(null);
    setRejectDialog({ open: false, row: null, reason: "" });
    await fetchAll();
  };

  const renderCard = (r: KycRow) => {
    const sim = Math.round((r.similarity ?? 0) * 100);
    const isReview = tab === "review" || tab === "pending";
    const isPending = r.status === "pending" || r.status === "pendente";
    const ageH = ageHours(r.created_at);
    const isOverdue = isPending && ageH > SLA_HOURS;
    const ageLabel =
      ageH < 1 ? `${Math.round(ageH * 60)}min` :
      ageH < 24 ? `${Math.round(ageH)}h` :
      `${Math.round(ageH / 24)}d`;
    return (
      <Card key={r.id} className={isOverdue ? "border-destructive/40 bg-destructive/[0.02]" : ""}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {(r.first_name?.[0] ?? "?")}{(r.last_name?.[0] ?? "")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm truncate">
                  {r.first_name} {r.last_name}
                </p>
                <Badge variant="outline" className="text-[10px]">{r.tipo === "medico" ? "Médico" : "Paciente"}</Badge>
                <Badge variant={sim >= 80 ? "default" : sim >= 60 ? "secondary" : "destructive"} className="text-[10px]">
                  {sim}% similaridade
                </Badge>
                {isPending && !isOverdue && (
                  <Badge variant="outline" className="text-amber-600 border-amber-200 text-[10px] gap-1">
                    <Clock className="w-3 h-3" /> Pendente · {ageLabel}
                  </Badge>
                )}
                {isOverdue && (
                  <Badge variant="destructive" className="text-[10px] gap-1 animate-pulse">
                    <AlertTriangle className="w-3 h-3" /> Fora do SLA · {ageLabel}
                  </Badge>
                )}
                {(r.status === "approved" || r.status === "aprovado") && (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-[10px] gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Aprovado
                  </Badge>
                )}
                {(r.status === "rejected" || r.status === "reprovado") && (
                  <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] gap-1">
                    <XCircle className="w-3 h-3" /> Rejeitado
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })} · ID: {r.user_id.slice(0, 8)}…
              </p>
            </div>
            {isReview && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  disabled={actionLoading === r.id}
                  onClick={() => approve(r)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  disabled={actionLoading === r.id}
                  onClick={() => openReject(r)}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout title="Admin" nav={adminNav}>
      <div className="space-y-5 pb-24 md:pb-8">
        <AdminPageHeader
          icon={ShieldCheck}
          eyebrow="Compliance"
          title="Revisão de KYC"
          description="Verificações biométricas pendentes ou em zona de auditoria. Aprovações/rejeições disparam email automático."
          accent="from-blue-500 to-cyan-600"
          badge={
            counts.overduePending > 0
              ? { label: `${counts.overduePending} fora do SLA (>24h)`, tone: "danger" }
              : counts.pending > 0
                ? { label: `${counts.pending} pendente${counts.pending === 1 ? "" : "s"}`, tone: "warning" }
                : undefined
          }
          actions={
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-1.5">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          }
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              Pendentes
              {counts.pending > 0 && (
                <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">{counts.pending}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Revisar
              {counts.review > 0 && (
                <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full">{counts.review}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Aprovados ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitados ({counts.rejected})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-2">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {tab === "pending" && "Nenhuma verificação pendente. 🎉"}
                  {tab === "review" && "Nenhuma verificação na zona de revisão."}
                  {tab === "approved" && "Nenhuma verificação aprovada ainda."}
                  {tab === "rejected" && "Nenhuma verificação rejeitada."}
                </p>
              </div>
            ) : (
              filtered.map(renderCard)
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={rejectDialog.open} onOpenChange={(o) => !o && setRejectDialog({ open: false, row: null, reason: "" })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Rejeitar verificação</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {rejectDialog.row && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <p><span className="font-medium">Usuário:</span> {rejectDialog.row.first_name} {rejectDialog.row.last_name}</p>
                  <p><span className="font-medium">Similaridade:</span> {Math.round((rejectDialog.row.similarity ?? 0) * 100)}%</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Motivo (opcional, vai pro email)</label>
                <Textarea
                  value={rejectDialog.reason}
                  onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
                  placeholder="Ex: foto borrada, documento ilegível..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialog({ open: false, row: null, reason: "" })}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmReject}>
                <XCircle className="w-4 h-4 mr-1" /> Confirmar rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminKycReview;
