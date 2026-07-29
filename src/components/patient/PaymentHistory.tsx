import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle2, Clock, XCircle, Shield, Sparkles, ArrowRight, ReceiptText, WalletCards, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getPatientNav } from "./patientNav";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import NfseLink from "./NfseLink";
import mascotWave from "@/assets/mascot-wave.png";
import type { Json } from "@/integrations/supabase/types";

interface SubscriptionEntry {
  id: string;
  plan_id: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  payment_method: string | null;
  notes: string | null;
  plan_name: string;
  plan_price: number;
  plan_description: string;
  plan_interval: string;
  plan_features: Json;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  active: { label: "Ativa", icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: "bg-[hsl(var(--p-success-soft))] text-success border-success/20" },
  cancelled: { label: "Cancelada", icon: <XCircle className="h-3.5 w-3.5" />, className: "bg-[hsl(var(--p-danger-soft))] text-destructive border-destructive/20" },
  expired: { label: "Vencida", icon: <Clock className="h-3.5 w-3.5" />, className: "bg-muted text-muted-foreground border-border" },
};

const PaymentHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subs, setSubs] = useState<SubscriptionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [nfseApptIds, setNfseApptIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) fetchPayments();
  }, [user]);

  // Notas fiscais (NFS-e) das consultas do paciente — escopado por RLS (patient_id = auth.uid()).
  useEffect(() => {
    if (!user) return;
    let active = true;
    const fetchNfse = async () => {
      try {
        const { data } = await db
          .from("nfse_invoices")
          .select("resource_id, status")
          .eq("resource_type", "appointment")
          .in("status", ["autorizado", "processando"]);
        if (!active) return;
        const ids = [...new Set(((data as any[]) ?? []).map((r) => r.resource_id).filter(Boolean))];
        setNfseApptIds(ids as string[]);
      } catch {
        if (active) setNfseApptIds([]);
      }
    };
    fetchNfse();
    return () => { active = false; };
  }, [user]);

  const fetchPayments = async () => {
    const { data: subsData } = await db
      .from("subscriptions")
      .select("id, plan_id, status, starts_at, expires_at, created_at, payment_method, notes")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!subsData || subsData.length === 0) {
      setLoading(false);
      return;
    }

    const planIds = [...new Set(subsData.map((s) => s.plan_id))];
    const { data: plans } = await db
      .from("plans")
      .select("id, name, price, description, features, interval")
      .in("id", planIds);
    const planMap = new Map((plans as any[])?.map((p: any) => [p.id, p]) ?? []);

    setSubs(subsData.map((s: any) => ({
      ...s,
      plan_name: (planMap.get(s.plan_id) as any)?.name ?? "Plano",
      plan_price: (planMap.get(s.plan_id) as any)?.price ?? 0,
      plan_description: (planMap.get(s.plan_id) as any)?.description ?? "",
      plan_interval: (planMap.get(s.plan_id) as any)?.interval ?? "monthly",
      plan_features: (planMap.get(s.plan_id) as any)?.features ?? [],
    })));
    setLoading(false);
  };

  const activeSub = subs.find((s) => s.status === "active");
  const totalPaid = subs.filter((s) => s.status === "active").reduce((sum, s) => sum + Number(s.plan_price || 0), 0);

  const generateReceipt = (s: SubscriptionEntry) => {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(0, 111, 207);
    doc.rect(0, 0, w, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("AloClinica", 20, 22);
    doc.setFontSize(10);
    doc.text("Recibo de Pagamento", 20, 32);
    doc.setTextColor(40, 40, 40);
    let y = 55;
    const line = (label: string, value: string) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(label, 20, y);
      doc.setFont("helvetica", "bold");
      doc.text(value, 90, y);
      y += 10;
    };
    line("Plano:", s.plan_name);
    line("Valor:", `R$ ${Number(s.plan_price).toFixed(2)}`);
    line("Status:", s.status === "active" ? "Ativa" : s.status === "cancelled" ? "Cancelada" : "Vencida");
    line("Data:", format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }));
    line("ID:", s.id.slice(0, 8).toUpperCase());
    doc.save(`recibo-aloclinica-${s.id.slice(0, 8)}.pdf`);
  };

  return (
    <DashboardLayout title="Paciente" nav={getPatientNav("payments")} role="patient">
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-24 md:pb-8">
        <section className="relative overflow-hidden rounded-[34px] border border-white/60 bg-[linear-gradient(135deg,#eef7ff_0%,#ffffff_50%,#f2fff8_100%)] p-5 shadow-[0_26px_80px_-50px_rgba(8,47,73,.68)] md:p-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/16 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-20 h-44 w-44 rounded-full bg-emerald-300/14 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/75 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Financeiro seguro
              </div>
              <h1 className="font-[Manrope] text-2xl font-black text-foreground md:text-3xl">Pagamentos</h1>
              <p className="mt-1 text-sm text-muted-foreground">Acompanhe assinaturas, recibos e status financeiro da sua conta.</p>
            </div>
            <Button className="h-11 rounded-full bg-[hsl(var(--p-primary))] px-5 font-bold text-white shadow-[var(--p-shadow-btn)]" onClick={() => navigate("/dashboard/plans")}>
              Ver planos <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </section>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-36 rounded-[30px]" />
            <Skeleton className="h-24 rounded-[26px]" />
            <Skeleton className="h-24 rounded-[26px]" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-border/40 bg-card/95 p-4 shadow-sm md:col-span-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Plano atual</p>
                    <h2 className="mt-1 font-[Manrope] text-2xl font-black text-foreground">{activeSub?.plan_name ?? "Sem plano ativo"}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeSub?.expires_at ? `Vence em ${format(new Date(activeSub.expires_at), "dd/MM/yyyy", { locale: ptBR })}` : "Escolha um plano para ativar os beneficios."}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <WalletCards className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                    {activeSub ? `R$ ${Number(activeSub.plan_price).toFixed(2).replace(".", ",")}` : "Aguardando escolha"}
                  </span>
                  {activeSub && (
                    <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
                      {activeSub.plan_interval === "monthly" ? "Mensal" : activeSub.plan_interval}
                    </span>
                  )}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="rounded-[28px] border border-border/40 bg-card/95 p-4 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Registros</p>
                <p className="mt-1 text-2xl font-black text-foreground">{subs.length}</p>
                <p className="text-xs text-muted-foreground">Total ativo: R$ {totalPaid.toFixed(2).replace(".", ",")}</p>
              </motion.div>
            </div>

            {subs.length > 0 ? (
              <div className="rounded-[30px] border border-border/40 bg-card/95 p-4 shadow-sm md:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-[Manrope] text-lg font-black text-foreground">Historico de pagamentos</h2>
                    <p className="text-xs text-muted-foreground">Baixe recibos e acompanhe o status de cada cobranca.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {subs.map((s, i) => {
                    const cfg = statusConfig[s.status] ?? statusConfig.expired;
                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.035 }}
                        className="flex items-center gap-4 rounded-[24px] border border-border/35 bg-background/70 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--p-shadow-card)]"
                      >
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${cfg.className}`}>
                          {cfg.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-foreground">{s.plan_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            {s.payment_method && ` - ${s.payment_method === "credit_card" ? "Cartao" : s.payment_method === "pix" ? "PIX" : s.payment_method}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-[Manrope] text-sm font-black text-foreground">R$ {Number(s.plan_price).toFixed(2).replace(".", ",")}</p>
                          <button className="ml-auto mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary" onClick={() => generateReceipt(s)}>
                            <Download className="h-3 w-3" /> Recibo
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-[30px] border border-dashed border-border/45 bg-card px-5 py-14 text-center shadow-sm">
                <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-primary/10 blur-3xl" />
                <CreditCard className="relative mx-auto mb-3 h-12 w-12 text-primary/45" />
                <p className="relative font-[Manrope] text-base font-black text-foreground">Nenhum pagamento registrado</p>
                <p className="relative mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Seus pagamentos e recibos aparecerao aqui assim que houver uma assinatura ativa.</p>
                <Button className="relative mt-5 h-11 rounded-full bg-[hsl(var(--p-primary))] px-5 font-bold text-white shadow-[var(--p-shadow-btn)]" onClick={() => navigate("/dashboard/plans")}>
                  Ver planos disponiveis
                </Button>
              </div>
            )}

            {nfseApptIds.length > 0 && (
              <div className="rounded-[30px] border border-border/40 bg-card/95 p-4 shadow-sm md:p-5">
                <div className="mb-4">
                  <h2 className="font-[Manrope] text-lg font-black text-foreground">Notas fiscais</h2>
                  <p className="text-xs text-muted-foreground">Baixe a NFS-e das suas consultas.</p>
                </div>
                <div className="space-y-2">
                  {nfseApptIds.map((id) => (
                    <NfseLink key={id} appointmentId={id} />
                  ))}
                </div>
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-4 rounded-[28px] border border-amber-300/25 bg-amber-50/70 p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-black text-foreground">Seguranca em primeiro lugar</p>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">Pagamentos protegidos, recibos gerados no dispositivo e historico acessivel pela sua conta.</p>
              </div>
              <img src={mascotWave} alt="Pingo" className="h-20 w-20 shrink-0 object-contain" loading="lazy" />
            </motion.div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PaymentHistory;
