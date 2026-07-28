import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  BarChart2,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  HeartPulse,
  Hourglass,
  Pill,
  ShieldCheck,
  Stethoscope,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "./DashboardLayout";
import AppPromotionalBanners from "./AppPromotionalBanners";
import ImminentConsultationBar from "./ImminentConsultationBar";
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
import doctorAppHero from "@/assets/doctor-app-command-center.png";
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

const statusTone: Record<string, string> = {
  scheduled: "border-blue-200 bg-blue-50 text-blue-700",
  waiting: "border-amber-200 bg-amber-50 text-amber-700",
  in_progress: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-slate-200 bg-slate-50 text-slate-600",
  cancelled: "border-red-200 bg-red-50 text-red-700",
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

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Stethoscope;
  tone: string;
}) {
  return (
    <motion.div variants={itemMotion} className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
      <div className={cn("mb-4 flex h-10 w-10 items-center justify-center rounded-2xl", tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-black leading-none tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    </motion.div>
  );
}

function QuickAction({
  label,
  description,
  icon: Icon,
  onClick,
  primary,
}: {
  label: string;
  description: string;
  icon: typeof Stethoscope;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-3xl border p-4 text-left shadow-sm transition active:scale-[0.99]",
        primary
          ? "border-emerald-200 bg-emerald-600 text-white shadow-[0_18px_38px_-30px_rgba(5,150,105,0.9)]"
          : "border-border/60 bg-card hover:border-emerald-200",
      )}
    >
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", primary ? "bg-white/16" : "bg-emerald-50 text-emerald-700")}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-black", primary ? "text-white" : "text-foreground")}>{label}</span>
        <span className={cn("mt-1 block text-xs leading-5", primary ? "text-white/72" : "text-muted-foreground")}>{description}</span>
      </span>
      <ArrowRight className={cn("h-4 w-4 shrink-0 transition group-hover:translate-x-0.5", primary ? "text-white/80" : "text-muted-foreground")} />
    </button>
  );
}

function AppointmentRow({ appt, onOpen }: { appt: DoctorAppt; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-3xl border border-border/55 bg-card p-3 text-left shadow-sm transition hover:border-emerald-200 active:scale-[0.99]"
    >
      <Avatar className="h-11 w-11 rounded-2xl">
        <AvatarFallback className="rounded-2xl bg-emerald-50 text-xs font-black text-emerald-700">
          {patientInitials(appt.patient_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-foreground">{appt.patient_name || "Paciente"}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {format(new Date(appt.scheduled_at), "dd/MM 'as' HH:mm", { locale: ptBR })}
        </p>
      </div>
      <Badge variant="outline" className={cn("h-7 rounded-full px-2.5 text-[10px] font-black", statusTone[appt.status] ?? "bg-muted text-muted-foreground")}>
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

  const metricCards = [
    { label: "Hoje", value: loading ? "..." : stats.today, icon: Stethoscope, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Fila", value: loading ? "..." : waitingCount, icon: Hourglass, tone: "bg-amber-50 text-amber-700" },
    { label: "Pacientes", value: loading ? "..." : stats.total_patients, icon: Users, tone: "bg-blue-50 text-blue-700" },
    { label: "Receitas", value: loading ? "..." : stats.prescriptions, icon: Pill, tone: "bg-cyan-50 text-cyan-700" },
  ];

  const tools = useMemo(
    () => [
      { label: "Agenda", description: "Calendario e disponibilidade", icon: Calendar, path: "/dashboard/doctor/calendar?role=doctor" },
      { label: "Pacientes", description: "Historico e prontuario", icon: Users, path: "/dashboard/patients?role=doctor" },
      { label: "Receitas", description: "Prescricoes e documentos", icon: FileText, path: "/dashboard/prescriptions?role=doctor" },
      { label: "Ganhos", description: "Faturamento medico", icon: DollarSign, path: "/dashboard/earnings?role=doctor" },
      { label: "Analises", description: "Indicadores da operacao", icon: BarChart2, path: "/dashboard/doctor/analytics?role=doctor" },
    ],
    [],
  );

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
        <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-center">
          <p className="text-sm font-bold text-red-700">Erro ao carregar dados do painel</p>
          <Button size="sm" variant="outline" className="mt-3 rounded-2xl" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      <motion.div initial="hidden" animate="show" className="mx-auto w-full max-w-6xl space-y-5 pb-24 md:pb-8">
        <ImminentConsultationBar appt={nextAppt as any} role="doctor" />

        <motion.section variants={itemMotion} className="overflow-hidden rounded-[30px] border border-border/60 bg-card shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
            <div className="p-4 sm:p-6 lg:p-7">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    <span className={cn("h-2 w-2 rounded-full", isOnline ? "bg-emerald-500" : "bg-slate-400")} />
                    {isOnline ? "Plantao ativo" : "Plantao pausado"}
                  </div>
                  <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
                    {greeting()}, Dr(a). {doctorName}
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    Um painel simples para conduzir o turno: entrar na sala, acompanhar a fila, revisar a agenda e acessar prontuarios.
                  </p>
                </div>
                {(data as any)?.crm && (
                  <div className="hidden shrink-0 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 sm:flex">
                    <ShieldCheck className="h-4 w-4" />
                    CRM
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-2 sm:flex">
                <Button className="h-12 rounded-2xl bg-emerald-600 px-5 font-black text-white hover:bg-emerald-700" onClick={() => navigate("/dashboard/doctor/waiting-room?role=doctor")}>
                  <Video className="mr-2 h-4 w-4" />
                  Abrir sala
                </Button>
                <Button
                  variant={isOnline ? "outline" : "default"}
                  className={cn("h-12 rounded-2xl px-5 font-black", !isOnline && "bg-slate-900 text-white hover:bg-slate-800")}
                  disabled={onlineLoading}
                  onClick={handleToggleOnline}
                >
                  {onlineLoading ? "Atualizando..." : isOnline ? "Pausar plantao" : "Ativar plantao"}
                </Button>
              </div>
            </div>

            <div className="border-t border-border/60 bg-muted/25 p-4 sm:p-6 lg:border-l lg:border-t-0">
              <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-background">
                <img src={doctorAppHero} alt="" className="h-44 w-full object-cover opacity-85" loading="eager" decoding="async" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                <img src={mascotWelcome} alt="Pingo" className="absolute bottom-3 right-3 h-20 w-20 object-contain drop-shadow-md" />
                <div className="absolute bottom-4 left-4 max-w-[190px]">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Turno clinico</p>
                  <p className="mt-1 text-sm font-black text-foreground">{format(new Date(), "EEEE, dd/MM", { locale: ptBR })}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <AppPromotionalBanners role="doctor" placement="dashboard" />

        <motion.section variants={itemMotion} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metricCards.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </motion.section>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <motion.section variants={itemMotion} className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Atendimento</p>
                <h2 className="text-xl font-black tracking-tight text-foreground">Fila e proximas consultas</h2>
              </div>
              <Button variant="ghost" size="sm" className="rounded-2xl text-xs font-black" onClick={() => navigate("/dashboard/doctor/consultations?role=doctor")}>
                Ver todas
              </Button>
            </div>

            {nextAppt ? (
              <div className="rounded-[30px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Proximo atendimento</p>
                    <h3 className="mt-2 truncate text-xl font-black text-emerald-950">{nextAppt.patient_name || "Paciente"}</h3>
                    <p className="mt-1 text-sm font-medium text-emerald-800">
                      {format(new Date(nextAppt.scheduled_at), "dd/MM 'as' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Button className="h-11 shrink-0 rounded-2xl bg-emerald-700 px-4 font-black text-white hover:bg-emerald-800" onClick={() => navigate(`/dashboard/consultation/${nextAppt.id}`)}>
                    Entrar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-[30px] border border-dashed border-border/60 bg-card p-6 text-center shadow-sm">
                <img src={mascotWelcome} alt="Pingo" className="mx-auto mb-3 h-20 w-20 object-contain" />
                <h3 className="text-lg font-black text-foreground">Turno tranquilo</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Nenhuma consulta em fila agora. Configure horarios para receber novos agendamentos.
                </p>
                <Button className="mt-4 h-11 rounded-2xl font-black" onClick={() => navigate("/dashboard/availability?role=doctor")}>
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
            <div className="rounded-[30px] border border-border/60 bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Resumo</p>
                  <h2 className="text-xl font-black tracking-tight text-foreground">Hoje</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <HeartPulse className="h-5 w-5" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-muted/45 p-3">
                  <p className="text-xl font-black text-foreground">{doneCount}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Feitas</p>
                </div>
                <div className="rounded-2xl bg-muted/45 p-3">
                  <p className="text-xl font-black text-foreground">{waitingCount}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Fila</p>
                </div>
                <div className="rounded-2xl bg-muted/45 p-3">
                  <p className="text-xl font-black text-foreground">{todayAppts.length}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Total</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {tools.map((tool, index) => (
                <QuickAction
                  key={tool.label}
                  label={tool.label}
                  description={tool.description}
                  icon={tool.icon}
                  primary={index === 0}
                  onClick={() => navigate(tool.path)}
                />
              ))}
            </div>
          </motion.aside>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
