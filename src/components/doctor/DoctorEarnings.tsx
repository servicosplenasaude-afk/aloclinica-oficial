import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getDoctorNav } from "./doctorNav";
 import { TrendingUp, Wallet, Clock, CheckCircle2, XCircle, Building2, AlertCircle, ArrowLeft, Sparkles, History, FileText, Download } from "lucide-react";
 import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { cn } from "@/lib/utils";
 import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
 import { toast } from "sonner";
 import { exportToCSV } from "@/lib/csv";

const PLATFORM_PERCENT = 50;
const DEFAULT_DOCTOR_PERCENT = 50;
const MIN_WITHDRAWAL = 50;

const DoctorEarnings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, pending: 0, thisMonth: 0, totalAppts: 0, available: 0 });
  const [monthlyData, setMonthlyData] = useState<{ month: string; consultas: number; valor: number }[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalsHasMore, setWithdrawalsHasMore] = useState(false);
  const [loadingMoreW, setLoadingMoreW] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [paidPayouts, setPaidPayouts] = useState<any[]>([]);
  const [irLoading, setIrLoading] = useState(true);
  const [irYear, setIrYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [pixKey, setPixKey] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clinicInfo, setClinicInfo] = useState<{ name: string; percent: number } | null>(null);
  const [payoutFreq, setPayoutFreq] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [savingFreq, setSavingFreq] = useState(false);

  useEffect(() => { if (user) fetchEarnings(); }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await db.from("doctor_profiles").select("payout_frequency").eq("user_id", user.id).maybeSingle();
        const f = (data as any)?.payout_frequency;
        if (f === "daily" || f === "weekly" || f === "monthly") setPayoutFreq(f);
      } catch { /* sem deps */ }
    })();
  }, [user]);

  // Relatório de renda (IR): busca todos os repasses PAGOS do médico — dados reais (issue #F2)
  useEffect(() => {
    if (!user) return;
    (async () => {
      setIrLoading(true);
      try {
        const { data: docProfile } = await db.from("doctor_profiles").select("id").eq("user_id", user.id).maybeSingle();
        if (!docProfile) { setPaidPayouts([]); return; }
        const { data: rows } = await db
          .from("doctor_payouts")
          .select("id, appointment_id, gross_amount, platform_fee, net_amount, status, paid_at, created_at")
          .eq("doctor_id", (docProfile as any).id)
          .eq("status", "paid")
          .order("paid_at", { ascending: true });
        const list = rows ?? [];
        // Resolve nomes de pacientes via appointment_id → patient_id → profile (mesmo padrão do extrato)
        const apptIds = [...new Set(list.map((p: any) => p.appointment_id).filter(Boolean))];
        const nameByAppt = new Map<string, string>();
        if (apptIds.length > 0) {
          const { data: apptRows } = await db.from("appointments").select("id, patient_id").in("id", apptIds as string[]);
          const patientByAppt = new Map<string, string>();
          (apptRows ?? []).forEach((a: any) => { if (a.patient_id) patientByAppt.set(a.id, a.patient_id); });
          const patientIds = [...new Set([...patientByAppt.values()])];
          if (patientIds.length > 0) {
            const { data: profs } = await db.from("profiles").select("user_id, first_name, last_name").in("user_id", patientIds);
            const nameByPatient = new Map<string, string>();
            (profs ?? []).forEach((pr: any) => {
              const nm = `${pr.first_name ?? ""} ${pr.last_name ?? ""}`.trim();
              if (nm) nameByPatient.set(pr.user_id, nm);
            });
            patientByAppt.forEach((pid, aid) => {
              const nm = nameByPatient.get(pid);
              if (nm) nameByAppt.set(aid, nm);
            });
          }
        }
        setPaidPayouts(list.map((p: any) => ({
          ...p,
          patientName: (p.appointment_id && nameByAppt.get(p.appointment_id)) || "Paciente",
        })));
      } catch { setPaidPayouts([]); }
      finally { setIrLoading(false); }
    })();
  }, [user]);

  const updatePayoutFreq = async (next: "daily" | "weekly" | "monthly") => {
    if (!user || next === payoutFreq) return;
    setSavingFreq(true);
    const prev = payoutFreq;
    setPayoutFreq(next);
    try {
      const { error } = await db.from("doctor_profiles")
        .update({ payout_frequency: next } as any).eq("user_id", user.id);
      if (error) throw error;
      toast.success("Frequência de repasse atualizada", { description: next === "daily" ? "Você receberá D+1 a partir do próximo dia útil." : next === "weekly" ? "Repasse semanal toda segunda-feira." : "Repasse mensal no dia 5." });
    } catch (e: any) {
      setPayoutFreq(prev);
      toast.error("Não foi possível atualizar", { description: e?.message });
    } finally {
      setSavingFreq(false);
    }
  };

  const fetchEarnings = async () => {
    const { data: docProfile } = await db.from("doctor_profiles").select("id, price").eq("user_id", user!.id).single();
    if (!docProfile) { setLoading(false); return; }

    // Check clinic affiliation for commission percent (issue #16)
    const { data: affiliation } = await db
      .from("clinic_affiliations")
      .select("commission_percent, clinic_id, clinic_profiles(name)")
      .eq("doctor_id", docProfile.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const doctorPercent = affiliation ? Number(affiliation.commission_percent) : DEFAULT_DOCTOR_PERCENT;
    if (affiliation) {
      setClinicInfo({
        name: (affiliation as { clinic_profiles?: { name?: string } | null }).clinic_profiles?.name ?? "Clínica",
        percent: doctorPercent,
      });
    }

    const [confirmedRes, pendingRes, withdrawRes, walletRes] = await Promise.all([
      // Only count appointments with confirmed payment (issue #5)
      db
        .from("appointments")
        .select("id, scheduled_at, status, payment_status, price_at_booking")
        .eq("doctor_id", docProfile.id)
        .eq("status", "completed")
        .in("payment_status", ["approved", "confirmed", "received"])
        .order("scheduled_at", { ascending: false }),
      db
        .from("appointments")
        .select("id, scheduled_at, price_at_booking")
        .eq("doctor_id", docProfile.id)
        .eq("status", "completed")
        .eq("payment_status", "pending")
        .order("scheduled_at", { ascending: false }),
      db
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const confirmedAppts = confirmedRes.data ?? [];
    const pendingAppts = pendingRes.data ?? [];
    const withdrawList = withdrawRes.data ?? [];
    setWithdrawals(withdrawList);
    setWithdrawalsHasMore(withdrawList.length === 20);

    const defaultPrice = Number(docProfile.price) || 89;

    // Use price_at_booking if available, otherwise fallback (issue #13)
    const getPrice = (appt: { price_at_booking?: number | null }) => Number(appt.price_at_booking) || defaultPrice;

    // Use wallet_transactions as source of truth if available
    const walletTxns = walletRes.data ?? [];
    const walletCredits = walletTxns.filter((t: any) => t.type === 'credit' || t.type === 'refund').reduce((s: number, t: any) => s + Number(t.amount), 0);
    const walletDebits = walletTxns.filter((t: any) => t.type === 'withdrawal' || t.type === 'debit').reduce((s: number, t: any) => s + Number(t.amount), 0);
    const hasWalletData = walletTxns.length > 0;

    const totalEarned = hasWalletData ? walletCredits : confirmedAppts.reduce((sum, a) => sum + getPrice(a) * (doctorPercent / 100), 0);
    const totalPending = pendingAppts.reduce((sum, a) => sum + getPrice(a) * (doctorPercent / 100), 0);
    const pendingWithdrawals = withdrawList
      .filter((w: { status?: string }) => ["pending", "processing"].includes(String(w.status ?? "")))
      .reduce((sum: number, w: { amount: number }) => sum + Number(w.amount), 0);
    const approvedWithdrawals = withdrawList
      .filter((w: { status?: string }) => w.status === "approved")
      .reduce((sum: number, w: { amount: number }) => sum + Number(w.amount), 0);
    const availableBalance = hasWalletData
      ? Math.max(0, walletCredits - walletDebits - pendingWithdrawals)
      : Math.max(0, totalEarned - approvedWithdrawals - pendingWithdrawals);

    const now = new Date();
    const monthStart = startOfMonth(now);
    const thisMonthAppts = confirmedAppts.filter(a => new Date(a.scheduled_at) >= monthStart);

    setStats({
      total: totalEarned,
      pending: totalPending,
      thisMonth: thisMonthAppts.reduce((sum, a) => sum + getPrice(a) * (doctorPercent / 100), 0),
      totalAppts: confirmedAppts.length,
      available: availableBalance,
    });

    // Last 6 months chart
    const chartData: { month: string; consultas: number; valor: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);
      const monthAppts = confirmedAppts.filter(a => {
        const d = new Date(a.scheduled_at);
        return d >= mStart && d <= mEnd;
      });
      chartData.push({
        month: format(m, "MMM", { locale: ptBR }),
        consultas: monthAppts.length,
        valor: monthAppts.reduce((sum, a) => sum + getPrice(a) * (doctorPercent / 100), 0),
      });
    }
    setMonthlyData(chartData);

    // Extrato de consultas: itemized payout ledger — real rows only (issue #F1)
    const { data: payoutRows } = await db
      .from("doctor_payouts")
      .select("id, appointment_id, gross_amount, net_amount, status, created_at, release_at, paid_at")
      .eq("doctor_id", docProfile.id)
      .order("created_at", { ascending: false })
      .limit(30);

    const payoutList = payoutRows ?? [];
    // Resolve patient names via appointment_id → patient_id → profile (graceful fallback)
    const payoutApptIds = [...new Set(payoutList.map((p: any) => p.appointment_id).filter(Boolean))];
    const nameByAppt = new Map<string, string>();
    if (payoutApptIds.length > 0) {
      const { data: apptRows } = await db
        .from("appointments")
        .select("id, patient_id")
        .in("id", payoutApptIds as string[]);
      const patientByAppt = new Map<string, string>();
      (apptRows ?? []).forEach((a: any) => { if (a.patient_id) patientByAppt.set(a.id, a.patient_id); });
      const patientIds = [...new Set([...patientByAppt.values()])];
      if (patientIds.length > 0) {
        const { data: profs } = await db
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", patientIds);
        const nameByPatient = new Map<string, string>();
        (profs ?? []).forEach((pr: any) => {
          const nm = `${pr.first_name ?? ""} ${pr.last_name ?? ""}`.trim();
          if (nm) nameByPatient.set(pr.user_id, nm);
        });
        patientByAppt.forEach((pid, aid) => {
          const nm = nameByPatient.get(pid);
          if (nm) nameByAppt.set(aid, nm);
        });
      }
    }
    setPayouts(payoutList.map((p: any) => ({
      ...p,
      patientName: (p.appointment_id && nameByAppt.get(p.appointment_id)) || "Paciente",
    })));

    setLoading(false);
  };

  const requestWithdrawal = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < MIN_WITHDRAWAL) {
      toast.error(`Valor mínimo para saque: R$ ${MIN_WITHDRAWAL.toFixed(2)}`);
      return;
    }
    if (amount > stats.available) {
      toast.error("Valor superior ao saldo disponível");
      return;
    }
    if (!pixKey.trim()) {
      toast.error("Informe sua chave PIX");
      return;
    }
    setSubmitting(true);
    const { error } = await db.from("withdrawal_requests").insert({
      user_id: user!.id,
      amount,
      pix_key: pixKey,
    });
    if (error) {
      toast.error("Erro ao solicitar saque");
    } else {
      toast.success("Solicitação de saque enviada! Processamento em 3-5 dias úteis.");
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setPixKey("");
      fetchEarnings();
    }
    setSubmitting(false);
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-secondary/10 text-secondary border-secondary/20 text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Aprovado</Badge>;
    if (status === "rejected") return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="w-3 h-3" />Rejeitado</Badge>;
    return <Badge variant="outline" className="text-xs gap-1"><Clock className="w-3 h-3" />Pendente</Badge>;
  };

  const payoutStatusBadge = (status: string) => {
    const s = String(status ?? "").toLowerCase();
    if (s === "paid") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Pago</Badge>;
    if (s === "ready") return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs gap-1"><Wallet className="w-3 h-3" />Liberado</Badge>;
    if (s === "pending") return <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-600"><Clock className="w-3 h-3" />Aguardando</Badge>;
    return <Badge variant="outline" className="text-xs gap-1"><Clock className="w-3 h-3" />{status}</Badge>;
  };

  // Relatório de renda (IR) — derivados a partir dos repasses PAGOS reais
  const irReceivedDate = (p: any) => new Date(p.paid_at ?? p.created_at);
  const irRows = paidPayouts.filter((p) => irReceivedDate(p).getFullYear() === irYear);
  const irTotal = irRows.reduce((s, p) => s + Number(p.net_amount || 0), 0);
  const irMonths = Array.from({ length: 12 }, (_, m) => {
    const rows = irRows.filter((p) => irReceivedDate(p).getMonth() === m);
    return {
      label: format(new Date(irYear, m, 1), "MMMM", { locale: ptBR }),
      total: rows.reduce((s, p) => s + Number(p.net_amount || 0), 0),
      count: rows.length,
    };
  }).filter((m) => m.count > 0);
  const currentYear = new Date().getFullYear();

  const downloadIrCSV = () => {
    if (irRows.length === 0) {
      toast.error("Sem repasses pagos neste período para exportar.");
      return;
    }
    const rows = irRows
      .slice()
      .sort((a, b) => irReceivedDate(a).getTime() - irReceivedDate(b).getTime())
      .map((p) => ({
        data: format(irReceivedDate(p), "dd/MM/yyyy", { locale: ptBR }),
        referencia: p.patientName || p.appointment_id || "—",
        bruto: Number(p.gross_amount || 0).toFixed(2).replace(".", ","),
        taxa: Number(p.platform_fee || 0).toFixed(2).replace(".", ","),
        liquido: Number(p.net_amount || 0).toFixed(2).replace(".", ","),
      }));
    exportToCSV(`relatorio-renda-${irYear}.csv`, rows, [
      { key: "data", label: "Data de recebimento" },
      { key: "referencia", label: "Paciente/Consulta" },
      { key: "bruto", label: "Valor bruto (R$)" },
      { key: "taxa", label: "Taxa da plataforma (R$)" },
      { key: "liquido", label: "Valor líquido recebido (R$)" },
    ]);
    toast.success(`Relatório de ${irYear} baixado (${rows.length} repasse${rows.length !== 1 ? "s" : ""}).`);
  };

  return (
    <DashboardLayout title="Médico" nav={getDoctorNav("earnings")}>
      <div className="w-full mx-auto max-w-4xl space-y-6 pb-24 md:pb-6">
        {/* Modern Header */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full" aria-label="Voltar ao painel">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">Ganhos e Finanças</h1>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Extrato Profissional</p>
              </div>
            </div>
            <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-2xl h-11 px-6 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20">
                  <Wallet className="w-4 h-4" /> Sacar R$ {stats.available.toFixed(0)}
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl">
                <DialogHeader>
                  <DialogTitle>Solicitar Saque</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="p-4 rounded-2xl bg-muted/50 border border-border/10">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Saldo Disponível</p>
                    <p className="text-2xl font-black text-foreground">R$ {stats.available.toFixed(2)}</p>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      {/* UI: associate label with input for a11y */}
                      <label htmlFor="withdraw-amount" className="text-xs font-bold text-muted-foreground uppercase px-1">Valor do Saque</label>
                      <Input id="withdraw-amount" type="number" placeholder={`Mínimo R$ ${MIN_WITHDRAWAL}`} value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="rounded-2xl h-12" />
                    </div>
                    <div className="space-y-1.5">
                      {/* UI: associate label with input for a11y */}
                      <label htmlFor="withdraw-pix" className="text-xs font-bold text-muted-foreground uppercase px-1">Chave PIX</label>
                      <Input id="withdraw-pix" placeholder="CPF, e-mail ou telefone" value={pixKey} onChange={e => setPixKey(e.target.value)} className="rounded-2xl h-12" />
                    </div>
                  </div>
                  <Button className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={requestWithdrawal} disabled={submitting || !withdrawAmount || !pixKey.trim()}>
                    {submitting ? "Processando..." : "Confirmar Saque"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Affiliate info pill */}
          {clinicInfo && (
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                Repasse de {clinicInfo.percent}% pela {clinicInfo.name}
              </p>
              <Sparkles className="w-3.5 h-3.5 text-primary/40 ml-auto" />
            </div>
          )}
        </div>

        {/* Modern Bento Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Confirmado", value: `R$ ${stats.total.toFixed(0)}`, color: "text-emerald-600", icon: "💰", bg: "bg-emerald-50/50" },
            { label: "Ganhos Mensais", value: `R$ ${stats.thisMonth.toFixed(0)}`, color: "text-blue-600", icon: "📈", bg: "bg-blue-50/50" },
            { label: "Aguardando", value: `R$ ${stats.pending.toFixed(0)}`, color: "text-amber-600", icon: "⏳", bg: "bg-amber-50/50" },
            { label: "Disponível", value: `R$ ${stats.available.toFixed(0)}`, color: "text-violet-600", icon: "💳", bg: "bg-violet-50/50" },
          ].map(s => (
            <div key={s.label} className={cn("p-4 rounded-3xl border border-border/10 flex flex-col justify-between min-h-[110px]", s.bg)}>
              <span className="text-lg">{s.icon}</span>
              <div>
                <p className={cn("text-xl font-black leading-none", s.color)}>{s.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 mt-1.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Withdrawal info pill */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/40 bg-card p-3 text-[11px] text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-semibold text-foreground">Saque PIX em 3-5 dias úteis</span>
          <span className="opacity-30">·</span>
          <span>Mínimo R$ {MIN_WITHDRAWAL.toFixed(2)}</span>
          <span className="opacity-30">·</span>
          <span>Repasse de {clinicInfo ? clinicInfo.percent : DEFAULT_DOCTOR_PERCENT}% por consulta</span>
        </div>

        {/* Breakdown explicado: como ganho de R$100 vira R$X no bolso */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Como funciona o repasse
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {(() => {
              const docPct = clinicInfo ? clinicInfo.percent : DEFAULT_DOCTOR_PERCENT;
              const platPct = clinicInfo ? Math.max(0, 100 - docPct) : PLATFORM_PERCENT;
              return (
                <>
                  <p className="text-muted-foreground mb-3">
                    Para uma consulta de <span className="font-bold text-foreground">R$ 100,00</span>:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/40">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-sm font-semibold text-foreground">Para você</span>
                        <span className="text-[11px] text-muted-foreground">({docPct}%)</span>
                      </div>
                      <span className="font-extrabold text-emerald-600">R$ {docPct.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                        <span className="text-sm font-medium text-foreground">
                          {clinicInfo ? `Clínica ${clinicInfo.name}` : "Plataforma AloClínica"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">({platPct}%)</span>
                      </div>
                      <span className="font-bold text-foreground">R$ {platPct.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/30 space-y-1.5 text-[12px] text-muted-foreground">
                    <p className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      Pagamento liberado <strong className="text-foreground">após confirmação da consulta</strong> (paciente comparece + status = concluída).
                    </p>
                    <p className="flex items-start gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                      Saque PIX cai em <strong className="text-foreground">3-5 dias úteis</strong> após solicitação.
                    </p>
                    <p className="flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      Não cobramos taxa de saque. Tarifas do PIX seguem regra do seu banco (em geral, R$ 0,00 PF).
                    </p>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="border-border mb-4">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4" /> Frequência de repasse</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Quando você quer receber o saldo disponível para saque?</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "daily" as const,  label: "Diário", help: "D+1 útil" },
                { v: "weekly" as const, label: "Semanal", help: "toda segunda" },
                { v: "monthly" as const,label: "Mensal", help: "dia 5" },
              ]).map((o) => (
                <button key={o.v} type="button" disabled={savingFreq} onClick={() => updatePayoutFreq(o.v)}
                  aria-pressed={payoutFreq === o.v}
                  className={`rounded-xl border p-3 text-left transition-all ${payoutFreq === o.v
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"} disabled:opacity-50`}>
                  <p className={`text-sm font-semibold ${payoutFreq === o.v ? "text-primary" : "text-foreground"}`}>{o.label}</p>
                  <p className="text-[10px] text-muted-foreground">{o.help}</p>
                </button>
              ))}
            </div>
            {(() => {
              const today = new Date();
              let next = new Date(today);
              if (payoutFreq === "daily") {
                next.setDate(next.getDate() + 1);
                // pula sábado/domingo (D+1 útil)
                while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
              } else if (payoutFreq === "weekly") {
                // próxima segunda-feira
                const diff = (8 - next.getDay()) % 7 || 7;
                next.setDate(next.getDate() + diff);
              } else {
                // dia 5 do próximo mês (ou deste, se ainda for futuro)
                next = today.getDate() < 5
                  ? new Date(today.getFullYear(), today.getMonth(), 5)
                  : new Date(today.getFullYear(), today.getMonth() + 1, 5);
              }
              const fmt = next.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
              return (
                <p className="text-xs text-foreground mt-3 pt-3 border-t border-border/40 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Próximo repasse: <span className="font-semibold">{fmt}</span>
                </p>
              );
            })()}
            <p className="text-[10px] text-muted-foreground mt-1.5">Transferência via Mercado Pago — o saldo disponível é enviado para o PIX cadastrado.</p>
          </CardContent>
        </Card>

        <Card className="border-border mb-8">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Faturamento Mensal</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="space-y-3"><div className="shimmer-v2 h-24 rounded-2xl"/><div className="shimmer-v2 h-24 rounded-2xl"/><div className="shimmer-v2 h-24 rounded-2xl"/></div> : monthlyData.length === 0 ? (
              <div className="py-12 text-center">
                <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">Sem faturamento ainda</p>
                <p className="text-xs text-muted-foreground">Seus ganhos por mês aparecem aqui após as primeiras consultas concluídas.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Valor"]} />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Extrato de consultas: line-item por consulta com repasse (issue #F1) */}
        <Card className="border-border mb-8">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><History className="w-5 h-5" /> Extrato de consultas</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="shimmer-v2 h-16 rounded-2xl" />)}</div>
            ) : payouts.length === 0 ? (
              <div className="py-10 text-center">
                <History className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">Nenhuma consulta com repasse ainda.</p>
                <p className="text-xs text-muted-foreground">Cada consulta concluída com pagamento aparece aqui com o seu repasse.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payouts.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.patientName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-black leading-none text-emerald-600">R$ {Number(p.net_amount).toFixed(2)}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">Bruto R$ {Number(p.gross_amount).toFixed(2)} · seu repasse 50%</p>
                      </div>
                      {payoutStatusBadge(p.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Relatório de renda (IR): total recebido + quebra mensal + CSV — issue #F2 */}
        <Card className="border-border mb-8">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" /> Relatório de renda (IR)
              </CardTitle>
              <div className="flex items-center gap-2">
                {[currentYear, currentYear - 1].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setIrYear(y)}
                    aria-pressed={irYear === y}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${irYear === y
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-foreground hover:border-primary/40"}`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {irLoading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="shimmer-v2 h-14 rounded-2xl" />)}</div>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/40 mb-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total recebido em {irYear}</p>
                  <p className="text-2xl font-black text-emerald-600">R$ {irTotal.toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {irRows.length} repasse{irRows.length !== 1 ? "s" : ""} com status pago (valor líquido recebido no seu PIX).
                  </p>
                </div>

                {irMonths.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium text-foreground">Nenhum repasse pago em {irYear}.</p>
                    <p className="text-xs text-muted-foreground">Quando os repasses forem pagos, aparecem aqui por mês.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 mb-4">
                    {irMonths.map((m) => (
                      <div key={m.label} className="flex items-center justify-between px-3 py-2 rounded-xl border border-border/60">
                        <span className="text-sm text-foreground capitalize">{m.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground">{m.count} repasse{m.count !== 1 ? "s" : ""}</span>
                          <span className="text-sm font-black text-emerald-600">R$ {m.total.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={downloadIrCSV}
                  disabled={irRows.length === 0}
                  className="w-full h-11 rounded-2xl gap-2 font-bold"
                >
                  <Download className="w-4 h-4" /> Baixar relatório (CSV)
                </Button>

                <div className="mt-4 pt-3 border-t border-border/30 space-y-1.5 text-[11px] text-muted-foreground">
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    Reflete valores <strong className="text-foreground">efetivamente recebidos</strong> (repasses com status pago), para seus próprios controles de Imposto de Renda.
                  </p>
                  <p className="flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    Não é documento fiscal. A emissão de <strong className="text-foreground">NFS-e</strong> e demais documentos oficiais é separada e feita fora da plataforma.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {withdrawals.length > 0 && (
          <Card className="border-border">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wallet className="w-5 h-5" /> Histórico de Saques</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {withdrawals.map(w => (
                  <div key={w.id} className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">R$ {Number(w.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(w.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        {w.pix_key && ` · PIX: ${w.pix_key}`}
                      </p>
                    </div>
                    {statusBadge(w.status)}
                  </div>
                ))}
              </div>
              {withdrawalsHasMore && (
                <div className="mt-3 flex justify-center">
                  <Button variant="outline" size="sm" className="rounded-xl"
                    disabled={loadingMoreW}
                    onClick={async () => {
                      setLoadingMoreW(true);
                      try {
                        const offset = withdrawals.length;
                        const { data } = await db.from("withdrawal_requests")
                          .select("*").eq("user_id", user!.id)
                          .order("created_at", { ascending: false })
                          .range(offset, offset + 19);
                        const more = data ?? [];
                        setWithdrawals((w) => [...w, ...more]);
                        setWithdrawalsHasMore(more.length === 20);
                      } finally { setLoadingMoreW(false); }
                    }}>
                    {loadingMoreW ? "Carregando…" : "Ver mais"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorEarnings;
