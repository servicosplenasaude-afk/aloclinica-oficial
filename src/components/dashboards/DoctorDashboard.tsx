import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, HeartPulse, ShieldCheck, Video } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "./DashboardLayout";
import AppPromotionalBanners from "./AppPromotionalBanners";
import ImminentConsultationBar from "./ImminentConsultationBar";
import { HeroBanner } from "./HeroBanner";
import { StatBento } from "./StatBento";
import { ActionPills } from "./ActionPills";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import DoctorOnboarding from "@/components/doctor/DoctorOnboarding";
import CrmApprovalTimeline from "@/components/doctor/CrmApprovalTimeline";
import { getDoctorNav } from "@/components/doctor/doctorNav";
import { useAuth } from "@/contexts/AuthContext";
import { useDoctorStats } from "@/hooks/useDoctorDashboard";
import { db } from "@/integrations/supabase/untyped";
import { logError } from "@/lib/logger";
import { cn } from "@/lib/utils";
import mascotWelcome from "@/assets/mascot-welcome.png";

interface DoctorAppt {
  id: string;
  scheduled_at: string;
  status: string;
  patient_id: string;
  patient_name: string;
  duration_minutes: number | null;
}

const statusLabel: Record<string, string> = {
  scheduled: "Agendada",
  completed: "Concluida",
  cancelled: "Cancelada",
  in_progress: "Em consulta",
  waiting: "Aguardando",
};

// Semantic status colors, dark-mode aware (tokens + dark: variants) so the
// badges stay legible em ambos os temas.
const statusTone: Record<string, string> = {
  scheduled: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300",
  waiting: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  in_progress: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  completed: "border-border bg-muted text-muted-foreground",
  cancelled: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
};

const itemMotion = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const } },
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function patientInitials(name?: string) {
  return (name || "Paciente")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function AppointmentRow({ appt, onOpen }: { appt: DoctorAppt; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-3xl border border-border/55 bg-card p-3 text-left shadow-sm transition hover:border-primary/40 active:scale-[0.99]"
    >
      <Avatar className="h-11 w-11 rounded-2xl">
        <AvatarFallback className="rounded-2xl bg-primary/10 text-xs font-bold text-primary">
          {patientInitials(appt.patient_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{appt.patient_name || "Paciente"}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {format(new Date(appt.scheduled_at), "dd/MM 'as' HH:mm", { locale: ptBR })}
        </p>
      </div>
      <Badge variant="outline" className={cn("h-7 rounded-full px-2.5 text-[10px] font-bold", statusTone[appt.status] ?? "bg-muted text-muted-foreground")}>
        {statusLabel[appt.status] ?? appt.status}
      </Badge>
    </button>
  );
}

const DoctorDashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const { data, isLoading: loading, isError, refetch } = useDoctorStats();

  useEffect(() => {
    if (!user?.id) return;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const channel = db
      .channel(`doctor-dashboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => refetch(), 300);
      })
      .subscribe();
    return () => {
      if (pending) clearTimeout(pending);
      db.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  useEffect(() => {
    if (!user?.id) return;
    loadOnlineStatus();
  }, [user?.id]);

  const loadOnlineStatus = async () => {
    try {
      // Canonical online flag: `available_now` — the column read by the
      // patient-facing "médicos disponíveis agora" list and by DoctorAvailability.
      const { data: doctor, error } = await db
        .from("doctor_profiles")
        .select("available_now")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) {
        setIsOnline(false);
        return;
      }

      setIsOnline((doctor as any)?.available_now ?? false);
    } catch (error) {
      logError("Error loading online status:", error);
    }
  };

  const handleToggleOnline = async () => {
    const newStatus = !isOnline;
    setOnlineLoading(true);

    try {
      // Write the canonical flag (+ companion timestamp) so the dashboard
      // "Plantão" toggle and the DoctorAvailability "Disponível para Agora"
      // switch stay in sync and patients see a consistent status.
      const { error } = await db
        .from("doctor_profiles")
        .update({
          available_now: newStatus,
          available_now_since: newStatus ? new Date().toISOString() : null,
        } as any)
        .eq("user_id", user!.id);

      if (error) {
        logError("Error updating online status:", error);
        toast.error("Erro ao atualizar status. Tente novamente.");
        return;
      }

      setIsOnline(newStatus);
      toast.success(newStatus ? "Plantao ativado" : "Plantao pausado");
    } catch (error) {
      logError("Error toggling online status:", error);
      toast.error("Erro ao atualizar status");
    } finally {
      setOnlineLoading(false);
    }
  };

  const stats = data?.stats ?? { today: 0, total_patients: 0, prescriptions: 0, totalEarnings: 0 };
  const todayAppts = ((data?.todayAppts ?? []) as DoctorAppt[]).slice().sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const upcomingAppts = ((data?.upcomingAppts ?? []) as DoctorAppt[]).slice(0, 5);
  const waitingCount = todayAppts.filter((appt) => appt.status === "waiting").length;
  const inProgress = todayAppts.find((appt) => appt.status === "in_progress");
  const nextAppt = inProgress ?? todayAppts.find((appt) => appt.status === "waiting" || appt.status === "scheduled") ?? upcomingAppts[0];
  const doneCount = todayAppts.filter((appt) => appt.status === "completed").length;
  const doctorName = profile?.first_name || "Doutor";

  return (
    <DashboardLayout title="Médico" nav={getDoctorNav("home")} role="doctor">
      {/* Mantém a orientação rica (DoctorOnboarding) por todo o onboarding — não
          apenas até o CRM ser preenchido. Ele calcula o próprio progresso e se
          auto-oculta ao atingir 100% (mostrando o card de "Perfil completo"),
          então o médico não perde a orientação enquanto ainda faltam agenda,
          preço, câmera, KYC, etc. */}
      {!loading && <DoctorOnboarding />}
      {!loading && data?.crm && data?.approval && !data.approval.is_approved && (
        <div className="mb-5">
          <CrmApprovalTimeline doctor={data.approval} />
        </div>
      )}

      {isError && (
        <div className="mb-5 rounded-3xl border border-destructive/30 bg-destructive/5 p-5 text-center">
          <p className="text-sm font-bold text-destructive">Erro ao carregar dados do painel</p>
          <Button size="sm" variant="outline" className="mt-3 rounded-2xl" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      <motion.div initial="hidden" animate="show" className="space-y-5 pb-24 md:pb-8">

        {/* ── Premium Doctor Hero ── */}
        <div className="-mx-4 -mt-5 md:-mx-6 md:-mt-5 lg:-mx-8 lg:-mt-6">
          <HeroBanner
            gradient="from-[#052e2b] via-[#0f766e] to-[#14b8a6]"
            pingoSrc={mascotWelcome}
            pingoAlt="Pingo"
            liveDot
            liveColor={isOnline ? "green" : "red"}
            bubble={{
              greeting: greeting(),
              name: `Dr(a). ${doctorName}`,
              sub: isOnline ? "Plantao ativo" : "Plantao pausado",
            }}
            kpis={[
              { label: "Hoje", value: loading ? "--" : stats.today },
              { label: "Fila", value: loading ? "--" : waitingCount },
              { label: "Pacientes", value: loading ? "--" : stats.total_patients },
              { label: "Receitas", value: loading ? "--" : stats.prescriptions },
            ]}
            loading={loading}
            topRight={data?.crm ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/90 backdrop-blur-md">
                <ShieldCheck className="h-3.5 w-3.5" /> CRM
              </span>
            ) : undefined}
          />
        </div>

        {/* ── CONTENT ── */}
        <div className="mt-5 space-y-5">
          <ImminentConsultationBar appt={nextAppt as any} role="doctor" />

          {/* Ações principais do plantão */}
          <motion.div variants={itemMotion} className="grid gap-2 sm:flex">
            <Button className="h-12 rounded-2xl px-5 font-bold" onClick={() => navigate("/dashboard/doctor/waiting-room?role=doctor")}>
              <Video className="mr-2 h-4 w-4" />
              Abrir sala
            </Button>
            <Button
              variant={isOnline ? "outline" : "default"}
              className="h-12 rounded-2xl px-5 font-bold"
              disabled={onlineLoading}
              onClick={handleToggleOnline}
            >
              {onlineLoading ? "Atualizando..." : isOnline ? "Pausar plantao" : "Ativar plantao"}
            </Button>
          </motion.div>

          <AppPromotionalBanners role="doctor" placement="dashboard" />

          {/* ── Ferramentas (Action Pills) ── */}
          <ActionPills title="Ferramentas" actions={[
            { label: "Agenda", icon: "📅", iconBg: "bg-emerald-50 dark:bg-emerald-950/30", path: "/dashboard/doctor/calendar?role=doctor" },
            { label: "Pacientes", icon: "👥", iconBg: "bg-blue-50 dark:bg-blue-950/30", path: "/dashboard/patients?role=doctor" },
            { label: "Receitas", icon: "📄", iconBg: "bg-violet-50 dark:bg-violet-950/30", path: "/dashboard/prescriptions?role=doctor" },
            { label: "Ganhos", icon: "💰", iconBg: "bg-amber-50 dark:bg-amber-950/30", path: "/dashboard/earnings?role=doctor" },
            { label: "Analises", icon: "📊", iconBg: "bg-cyan-50 dark:bg-cyan-950/30", path: "/dashboard/doctor/analytics?role=doctor" },
          ]} />

          {/* ── Bento Stats ── */}
          <StatBento loading={loading} stats={[
            { label: "Hoje", value: stats.today, icon: "🩺", iconBg: "bg-emerald-50 dark:bg-emerald-950/30", valueClass: "text-emerald-700 dark:text-emerald-400", accentClass: "bg-emerald-500" },
            { label: "Fila", value: waitingCount, icon: "⏳", iconBg: "bg-amber-50 dark:bg-amber-950/30", valueClass: "text-amber-600 dark:text-amber-400", accentClass: "bg-amber-500" },
            { label: "Pacientes", value: stats.total_patients, icon: "👥", iconBg: "bg-blue-50 dark:bg-blue-950/30", valueClass: "text-[#1255C8] dark:text-blue-400", accentClass: "bg-blue-500" },
            { label: "Receitas", value: stats.prescriptions, icon: "💊", iconBg: "bg-cyan-50 dark:bg-cyan-950/30", valueClass: "text-cyan-700 dark:text-cyan-400", accentClass: "bg-cyan-500" },
          ]} />

          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <motion.section variants={itemMotion} className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Atendimento</p>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">Fila e proximas consultas</h2>
                </div>
                <Button variant="ghost" size="sm" className="rounded-2xl text-xs font-semibold" onClick={() => navigate("/dashboard/doctor/consultations?role=doctor")}>
                  Ver todas
                </Button>
              </div>

              {nextAppt ? (
                <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Proximo atendimento</p>
                      <h3 className="mt-2 truncate text-xl font-bold text-foreground">{nextAppt.patient_name || "Paciente"}</h3>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">
                        {format(new Date(nextAppt.scheduled_at), "dd/MM 'as' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Button className="h-11 shrink-0 rounded-2xl px-4 font-bold" onClick={() => navigate(`/dashboard/consultation/${nextAppt.id}`)}>
                      Entrar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-border/60 bg-card p-6 text-center shadow-sm">
                  <img src={mascotWelcome} alt="Pingo" className="mx-auto mb-3 h-20 w-20 object-contain" />
                  <h3 className="text-lg font-bold text-foreground">Turno tranquilo</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Nenhuma consulta em fila agora. Configure horarios para receber novos agendamentos.
                  </p>
                  <Button className="mt-4 h-11 rounded-2xl font-bold" onClick={() => navigate("/dashboard/availability?role=doctor")}>
                    Configurar agenda
                  </Button>
                </div>
              )}

              <div className="grid gap-3">
                {(todayAppts.length ? todayAppts.slice(0, 4) : upcomingAppts).map((appt) => (
                  <AppointmentRow key={appt.id} appt={appt} onOpen={() => navigate(`/dashboard/consultation/${appt.id}`)} />
                ))}
              </div>
            </motion.section>

            <motion.aside variants={itemMotion} className="space-y-3">
              <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Resumo</p>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">Hoje</h2>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <HeartPulse className="h-5 w-5" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-muted/45 p-3">
                    <p className="text-xl font-bold text-foreground">{doneCount}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Feitas</p>
                  </div>
                  <div className="rounded-2xl bg-muted/45 p-3">
                    <p className="text-xl font-bold text-foreground">{waitingCount}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Fila</p>
                  </div>
                  <div className="rounded-2xl bg-muted/45 p-3">
                    <p className="text-xl font-bold text-foreground">{todayAppts.length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
