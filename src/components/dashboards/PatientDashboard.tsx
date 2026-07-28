import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "./DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import { getPatientNav } from "@/components/patient/patientNav";
import { useTranslation } from "@/i18n";
import { format, differenceInDays, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck, VideoCamera, Clock, Gift, ArrowRight,
  Heart, Lightning, ClipboardText, FileText, UploadSimple,
  Sparkle, Stethoscope, MagnifyingGlass, Plus, Warning, Robot,
  Pill, Heartbeat, TrendUp, ChatCircleDots, DotsThreeVertical,
} from "@phosphor-icons/react";
import { AlertTriangle, RefreshCw, ShieldCheck, Lock } from "lucide-react";
import PatientOnboarding, { ONBOARDING_KEY, KYC_PENDING_KEY } from "@/components/patient/PatientOnboarding";
import { PingoMascot } from "@/components/mascot/PingoMascot";
import LazyAvatar from "@/components/ui/lazy-avatar";
import PatientWaitingCard from "@/components/patient/PatientWaitingCard";
import SectionErrorBoundary from "@/components/ui/section-error-boundary";
import PatientHealthReport from "@/components/patient/PatientHealthReport";
import {
   usePatientStats, usePatientUpcoming, useReturnAppointments, useRecentHealthMetrics, useHealthTimeline,
  useFavoriteDoctors, useDetectPatientService, type ServiceType,
} from "@/hooks/usePatientDashboard";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import FirstConsultationTour from "@/components/patient/FirstConsultationTour";
import ImminentConsultationBar from "./ImminentConsultationBar";
import AppPromotionalBanners from "./AppPromotionalBanners";

/* ── Constants ── */
const HEALTH_TIPS = [
  { title: "Hidratação é chave!", body: "Beba pelo menos 2L de água ao longo do dia para manter corpo e mente funcionando bem.", metric: "2L", metricLabel: "Meta diária", emoji: "💧" },
  { title: "Mexa-se hoje!", body: "30 minutos de caminhada por dia reduzem a ansiedade e melhoram o humor.", metric: "30min", metricLabel: "Por dia", emoji: "🏃" },
  { title: "Durma bem", body: "Dormir de 7 a 9 horas fortalece a memória, o humor e a imunidade.", metric: "7-9h", metricLabel: "Por noite", emoji: "😴" },
  { title: "Coma colorido", body: "Inclua frutas, verduras e legumes em pelo menos 3 refeições do seu dia.", metric: "5", metricLabel: "Porções/dia", emoji: "🥗" },
  { title: "Descanse os olhos", body: "A cada 20 minutos de tela, olhe para longe por 20 segundos para relaxar a visão.", metric: "20-20-20", metricLabel: "Descanso visual", emoji: "👀" },
  { title: "Respire fundo", body: "Reserve alguns minutos para respirar com calma e aliviar o estresse do dia.", metric: "5min", metricLabel: "Respiro diário", emoji: "🧘" },
  { title: "Vacinas em dia", body: "Mantenha sua carteira de vacinação atualizada, inclusive na vida adulta.", metric: "Em dia", metricLabel: "Vacinação", emoji: "💉" },
  { title: "Faça check-ups", body: "Consultas de rotina ajudam a prevenir e detectar problemas mais cedo.", metric: "1x/ano", metricLabel: "Check-up", emoji: "🩺" },
  { title: "Não fique parado", body: "Se você trabalha sentado, levante-se e alongue-se a cada hora.", metric: "1x/h", metricLabel: "Alongue-se", emoji: "🧍" },
  { title: "Pegue um sol", body: "15 minutos de sol pela manhã ajudam o corpo a produzir vitamina D.", metric: "15min", metricLabel: "Sol da manhã", emoji: "☀️" },
  { title: "Menos açúcar", body: "Troque refrigerantes e sucos adoçados por água ou frutas naturais.", metric: "Menos", metricLabel: "Açúcar", emoji: "🍎" },
  { title: "Lave as mãos", body: "Lavar as mãos com água e sabão previne gripes, resfriados e infecções.", metric: "20s", metricLabel: "Higiene", emoji: "🧼" },
  { title: "Cuide do sorriso", body: "Escove os dentes e use fio dental todos os dias para a saúde da boca.", metric: "2x/dia", metricLabel: "Escovação", emoji: "🦷" },
  { title: "Cuide da mente", body: "Manter contato com quem você gosta faz bem para a saúde mental.", metric: "Conecte-se", metricLabel: "Bem-estar", emoji: "💬" },
];

const getQuickActions = (serviceType: ServiceType) => [
  { label: "Agendar",  icon: CalendarCheck,   path: "/dashboard/schedule?role=patient",                      color: "hsl(215,75%,32%)", bg: "hsl(215,75%,32%,0.08)" },
  { label: "Urgência", icon: Lightning,       path: "/dashboard/urgent-care?role=patient",                   color: "hsl(0,72%,48%)",   bg: "hsl(0,72%,48%,0.08)"   },
  { label: "Pingo IA", icon: Robot,           path: "/dashboard/ai-assistant?role=patient&tab=triagem",      color: "hsl(195,70%,38%)", bg: "hsl(195,70%,38%,0.10)" },
  { label: "Chat",     icon: ChatCircleDots,  path: "/dashboard/chat?role=patient",                          color: "hsl(168,55%,35%)", bg: "hsl(168,55%,35%,0.10)" },
  { label: "Exames",   icon: ClipboardText,   path: "/dashboard/patient/documents?role=patient",             color: "hsl(225,55%,40%)", bg: "hsl(225,55%,40%,0.08)" },
];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const getAvatarRingColor = (nextAppt: any) => {
  if (!nextAppt) return "ring-emerald-400";
  const mins = differenceInMinutes(new Date(nextAppt.scheduled_at), new Date());
  if (mins <= 60) return "ring-red-400 animate-pulse";
  return "ring-emerald-400";
};

const getContextualSubtitle = (upcoming: any[], stats: any) => {
  if ((upcoming?.length ?? 0) > 0) return "Você tem consultas agendadas";
  return "Tudo em dia por aqui ✓";
};

const getServiceTypeFromParam = (searchParams: URLSearchParams): ServiceType | null => {
  const service = searchParams.get("service")?.toLowerCase();
  return service === "telemedicina" ? service as ServiceType : null;
};

const SERVICE_SECTIONS = {
  telemedicina: { kpis: true, nextAppt: true, quickActions: true, healthTip: true, returnAppts: true, pendingAppt: true },
  all: { kpis: true, nextAppt: true, quickActions: true, healthTip: true, returnAppts: true, pendingAppt: true },
};

/* ── Main Component ── */
const PatientDashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const forceOnboarding = searchParams.get("onboarding") === "true";
  const { data: detectedService, isLoading: detectingService } = useDetectPatientService();
  const serviceType = getServiceTypeFromParam(searchParams) || detectedService || "all";
  const sections = SERVICE_SECTIONS[serviceType as keyof typeof SERVICE_SECTIONS] || SERVICE_SECTIONS.all;
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingDone] = useLocalStorage<boolean>(ONBOARDING_KEY, false);
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = usePatientStats();
  const { data: upcoming = [], isLoading: upcomingLoading, isError: upcomingError } = usePatientUpcoming();
  const { data: returnAppts = [] } = useReturnAppointments();
  const { data: healthMetrics = [] } = useRecentHealthMetrics();
  const { data: favoriteDoctors = [] } = useFavoriteDoctors();
  const { data: timelineEvents = [], isLoading: timelineLoading } = useHealthTimeline(3);
  const loading = statsLoading || upcomingLoading || detectingService;
  const waitingAppt = upcoming.find((a: any) => a.status === "waiting" || a.status === "in_progress") ?? null;
  const nextAppt = upcoming[0];
  const minutesUntilNext = nextAppt ? differenceInMinutes(new Date(nextAppt.scheduled_at), new Date()) : null;
  // Varia a dica pelo dia do ano para percorrer todo o pool ao longo das semanas
  // (getDay() daria só 0-6 e nunca mostraria as dicas além do 7º índice).
  const _now = new Date();
  const dayOfYear = Math.floor((_now.getTime() - new Date(_now.getFullYear(), 0, 0).getTime()) / 86400000);
  const todayTip = HEALTH_TIPS[dayOfYear % HEALTH_TIPS.length];
  const firstName = profile?.first_name || "Paciente";
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["patient-upcoming-enriched"] });
    await queryClient.invalidateQueries({ queryKey: ["patient-dashboard-stats"] });
    await queryClient.invalidateQueries({ queryKey: ["patient-return-appts"] });
    await queryClient.invalidateQueries({ queryKey: ["patient-recent-metrics"] });
    await queryClient.invalidateQueries({ queryKey: ["patient-fav-doctors"] });
    setTimeout(() => setIsRefreshing(false), 600);
  }, [queryClient]);

  // Realtime: revalida o painel quando appointments do paciente mudam
  useEffect(() => {
    if (!user?.id) return;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const ch = db
      .channel(`patient-dashboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `patient_id=eq.${user.id}` }, () => {
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["patient-upcoming-enriched"] });
          queryClient.invalidateQueries({ queryKey: ["patient-dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["patient-return-appts"] });
        }, 250);
      })
      .subscribe();
    return () => { if (pending) clearTimeout(pending); db.removeChannel(ch); };
  }, [user?.id, queryClient]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => { if (el.scrollTop <= 0) pullStartY.current = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      if (pullStartY.current === 0) return;
      const delta = e.touches[0].clientY - pullStartY.current;
      if (delta > 60 && el.scrollTop <= 0) setIsPulling(true);
    };
    const onTouchEnd = () => { if (isPulling) { handleRefresh(); setIsPulling(false); } pullStartY.current = 0; };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => { el.removeEventListener("touchstart", onTouchStart); el.removeEventListener("touchmove", onTouchMove); el.removeEventListener("touchend", onTouchEnd); };
  }, [isPulling, handleRefresh]);

   useEffect(() => {
     if (loading) return;
 
     // Check metadata first (more reliable cross-device)
     const hasCompletedOnboardingMetadata = user?.user_metadata?.onboarding_completed === true;
     
     // Consider profile incomplete if essential fields are missing
     const profileIncomplete = !profile?.cpf || !profile?.phone || !profile?.date_of_birth;
 
     // Priority 1: Force via URL (signup redirect)
     if (forceOnboarding) {
       setShowOnboarding(true);
       return;
     }
 
     // Priority 2: If it's the first login after signup (checked via param)
     // or if they have absolutely no profile data and haven't dismissed onboarding yet
     if (!hasCompletedOnboardingMetadata && !onboardingDone) {
       const isVeryNewUser = profile?.created_at ? (Date.now() - new Date(profile.created_at).getTime() < 3600000) : true;
       
       if (isVeryNewUser && profileIncomplete) {
         setShowOnboarding(true);
       }
     }
   }, [loading, stats?.total, onboardingDone, forceOnboarding, profile, user]);

  if (loading) return (
    <DashboardLayout title="Perfil do Paciente" nav={getPatientNav("home", t)} role="patient">
      <div className="space-y-6 max-w-7xl mx-auto" aria-busy="true" aria-label="Carregando seu painel">
        {/* Hero */}
        <Skeleton className="h-56 md:h-64 rounded-[2rem]" />
        {/* Ações rápidas */}
        <div>
          <Skeleton className="h-4 w-32 mb-3 rounded" />
          <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-4">
            {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        </div>
        {/* Próxima consulta + KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout title="Perfil do Paciente" nav={getPatientNav("home", t)} role="patient">
      {showOnboarding && <PatientOnboarding onComplete={() => setShowOnboarding(false)} />}
      {!showOnboarding && <FirstConsultationTour />}
      <div ref={scrollRef} className="space-y-6 pb-24 md:pb-12 max-w-7xl mx-auto">
        {waitingAppt ? (
          <SectionErrorBoundary fallbackTitle="Erro na sala de espera">
            <PatientWaitingCard appointment={waitingAppt} />
          </SectionErrorBoundary>
        ) : (
          <ImminentConsultationBar appt={nextAppt} role="patient" />
        )}
        <PatientHomeModern
          firstName={firstName}
          stats={stats}
          nextAppt={nextAppt}
          timelineEvents={timelineEvents}
          returnAppts={returnAppts}
          favoriteDoctors={favoriteDoctors}
          healthMetrics={healthMetrics}
          healthTip={todayTip}
          navigate={navigate}
        />
      </div>
    </DashboardLayout>
  );
};

const PatientHomeModern = ({ firstName, stats, nextAppt, timelineEvents, returnAppts = [], favoriteDoctors = [], healthMetrics = [], healthTip, navigate }: any) => {
  const scheduledAt = nextAppt ? new Date(nextAppt.scheduled_at) : null;
  const activities = (timelineEvents ?? []).slice(0, 3);
  const PAID_STATUSES = ["approved", "confirmed", "received", "paid"];
  const paymentApproved = nextAppt ? PAID_STATUSES.includes(String(nextAppt.payment_status ?? "").toLowerCase()) : false;
  const nextPaymentPending = !!nextAppt && nextAppt.status === "scheduled" && !paymentApproved;
  const returns = (returnAppts ?? []).slice(0, 3);
  const favorites = (favoriteDoctors ?? []).slice(0, 6);
  const healthNudge = (healthMetrics?.length ?? 0) > 0
    ? { title: "Acompanhe sua saúde", sub: "Veja seus indicadores e evolução", path: "/dashboard/patient/health?role=patient" }
    : { title: "Comece seu diário de sintomas", sub: "Registre como você se sente hoje", path: "/dashboard/patient/diary?role=patient" };
  const actionCards = [
    { label: "Agendar", sub: "Consulta", icon: CalendarCheck, path: "/dashboard/schedule?role=patient", tone: "from-blue-500 to-cyan-500", soft: "bg-blue-500/10 text-blue-600" },
    { label: "Urgência", sub: "Agora", icon: Lightning, path: "/dashboard/urgent-care?role=patient", tone: "from-rose-500 to-orange-500", soft: "bg-rose-500/10 text-rose-600" },
    { label: "Receitas", sub: "Histórico", icon: FileText, path: "/dashboard/history?role=patient", tone: "from-teal-500 to-emerald-500", soft: "bg-teal-500/10 text-teal-600" },
    { label: "Exames", sub: "Documentos", icon: Pill, path: "/dashboard/patient/documents?role=patient", tone: "from-violet-500 to-indigo-500", soft: "bg-violet-500/10 text-violet-600" },
  ];
  const healthItems = [
    { label: "Consultas", value: stats?.total ?? 0, icon: CalendarCheck, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Receitas", value: stats?.prescriptions ?? 0, icon: FileText, color: "text-teal-600", bg: "bg-teal-500/10" },
    { label: "Exames", value: stats?.documents ?? 0, icon: Pill, color: "text-indigo-600", bg: "bg-indigo-500/10" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-4 md:space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[32px] border border-white/50 bg-[linear-gradient(135deg,#eef7ff_0%,#ffffff_45%,#e9fbff_100%)] p-4 shadow-[0_24px_70px_-42px_rgba(15,42,90,.55)] md:p-7"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-40 w-40 rounded-full bg-teal-300/18 blur-3xl" />
        <div className="relative grid gap-5 md:grid-cols-[1fr_310px] md:items-center">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/15 bg-white/70 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-blue-700 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              Dados seguros
            </div>
            <h1 className="font-[Manrope] text-[28px] font-black leading-tight tracking-tight text-slate-950 md:text-[42px]">
              Olá, {firstName}
            </h1>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-600 md:text-base">
              Seu cuidado em um app simples, rápido e organizado para consultas, receitas e exames.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {actionCards.map((item, index) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + index * 0.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(item.path)}
                  className="group rounded-[22px] border border-white bg-white p-3 text-left shadow-[0_14px_34px_-28px_rgba(15,42,90,.65)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(15,42,90,.75)]"
                >
                  <div className={cn("mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition group-hover:scale-105", item.tone)}>
                    <item.icon size={22} weight="bold" />
                  </div>
                  <p className="text-sm font-black text-slate-950">{item.label}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-500">{item.sub}</p>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="relative min-h-[176px] overflow-hidden rounded-[28px] border border-white/70 bg-white/86 p-4 shadow-[0_18px_48px_-34px_rgba(15,42,90,.8)] backdrop-blur">
            <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Assistente Pingo</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Como posso ajudar?</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Atendimento, exames e orientação sempre à mão.</p>
              </div>
              <PingoMascot variant="wave" size={82} animate bounce className="shrink-0 drop-shadow-[0_16px_28px_rgba(15,42,90,.18)]" />
            </div>
            <Button
              onClick={() => navigate("/dashboard/chat?role=patient")}
              className="relative mt-4 h-11 w-full rounded-2xl font-black"
            >
              Falar com suporte
              <ArrowRight size={16} weight="bold" />
            </Button>
          </div>
        </div>
      </motion.section>

      {nextPaymentPending && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => navigate(`/dashboard/schedule/${nextAppt.doctor_id}?resume=${nextAppt.id}`)}
          className="flex w-full items-center gap-4 rounded-[24px] border border-amber-500/25 bg-amber-500/[0.07] p-4 text-left shadow-sm transition hover:-translate-y-0.5"
        >
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/25">
            <Warning size={24} weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-amber-700">Pagamento pendente</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-amber-700/80">
              Finalize para confirmar sua consulta com {nextAppt.doctor_name}.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-3 py-2 text-[11px] font-black text-white sm:px-4 sm:text-xs">
            <span className="hidden sm:inline">Finalizar pagamento</span>
            <ArrowRight size={14} weight="bold" />
          </span>
        </motion.button>
      )}

      {healthTip && (
        <section className="flex items-center gap-4 rounded-[28px] border border-primary/15 bg-primary/[0.04] p-4 shadow-sm md:p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl" aria-hidden="true">
            {healthTip.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary/80">Dica de saúde do dia</p>
            <p className="mt-0.5 text-sm font-bold text-foreground">{healthTip.title}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{healthTip.body}</p>
          </div>
          {healthTip.metric && (
            <div className="hidden shrink-0 text-right sm:block">
              <p className="font-[Manrope] text-lg font-black text-primary tabular-nums">{healthTip.metric}</p>
              <p className="text-[10px] text-muted-foreground">{healthTip.metricLabel}</p>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-[28px] border border-border/55 bg-card p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Próxima consulta</p>
              <h2 className="mt-1 text-lg font-black text-foreground">{nextAppt ? "Consulta agendada" : "Agenda livre"}</h2>
            </div>
            <span className={cn(
              "rounded-full px-3 py-1 text-[11px] font-black",
              !nextAppt
                ? "bg-blue-500/10 text-blue-700"
                : paymentApproved
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-amber-500/10 text-amber-700"
            )}>
              {!nextAppt ? "Disponível" : paymentApproved ? "Confirmada" : "Aguardando pagamento"}
            </span>
          </div>
          <div className="flex gap-4 rounded-[24px] bg-muted/25 p-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
              <VideoCamera size={30} weight="fill" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-foreground">{nextAppt?.doctor_name ?? "Nenhuma consulta marcada"}</p>
              <p className="text-sm font-medium text-muted-foreground">{nextAppt ? (nextAppt.specialty ?? "Atendimento médico") : "Escolha um médico para começar"}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
                <span className="rounded-full bg-background px-2.5 py-1 text-primary">{scheduledAt ? format(scheduledAt, "dd MMM", { locale: ptBR }) : "Sem data"}</span>
                <span className="rounded-full bg-background px-2.5 py-1 text-primary">{scheduledAt ? format(scheduledAt, "HH:mm") : "--:--"}</span>
                <span className={cn(
                  "rounded-full px-2.5 py-1",
                  nextAppt && !paymentApproved ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700"
                )}>
                  {nextAppt && !paymentApproved ? "Aguardando pagamento" : "Online"}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => navigate("/dashboard/appointments?role=patient")} className="h-11 rounded-2xl font-black">
              Detalhes
            </Button>
            <Button onClick={() => navigate(nextAppt ? `/dashboard/consultation/${nextAppt.id}` : "/dashboard/schedule?role=patient")} className="h-11 rounded-2xl font-black">
              {nextAppt ? "Entrar" : "Agendar"}
            </Button>
          </div>
        </section>

        <section className="rounded-[28px] border border-border/55 bg-card p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Resumo</p>
              <h2 className="mt-1 text-lg font-black text-foreground">Sua saúde</h2>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-500/10 text-orange-500">
              <Heartbeat size={25} weight="fill" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {healthItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-border/40 bg-background p-3">
                <div className={cn("mb-3 grid h-9 w-9 place-items-center rounded-xl", item.bg, item.color)}>
                  <item.icon size={19} weight="bold" />
                </div>
                <p className={cn("text-2xl font-black leading-none", item.color)}>{item.value}</p>
                <p className="mt-1 text-[11px] font-bold text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {returns.length > 0 && (
        <section className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/[0.05] p-4 shadow-sm md:p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600">
              <Gift size={18} weight="fill" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Retorno disponível</p>
              <p className="text-xs font-semibold text-muted-foreground">Reagende sem custo dentro do prazo</p>
            </div>
          </div>
          <div className="grid gap-2">
            {returns.map((ra: any) => (
              <div key={ra.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-card p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <LazyAvatar name={ra.doctor_name} className="h-10 w-10" fallbackClassName="bg-emerald-500/10 text-emerald-700 text-xs font-black" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-foreground">{ra.doctor_name}</p>
                    <p className="truncate text-xs font-medium text-muted-foreground">Válido até {format(new Date(ra.return_deadline), "dd/MM")}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => navigate(`/dashboard/schedule/${ra.doctor_id}?return=true&original=${ra.id}`)} className="h-9 shrink-0 rounded-full bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700">
                  Agendar
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {favorites.length > 0 && (
        <section className="rounded-[28px] border border-border/55 bg-card p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Meu médico</p>
              <h2 className="mt-1 text-lg font-black text-foreground">Agende de novo</h2>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-500">
              <Heart size={24} weight="fill" />
            </div>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {favorites.map((doc: any) => (
              <div key={doc.id} className="flex w-[150px] shrink-0 flex-col items-center rounded-2xl border border-border/40 bg-background p-3 text-center">
                <LazyAvatar name={doc.name} className="h-14 w-14" fallbackClassName="bg-primary/10 text-primary text-sm font-black" />
                <p className="mt-2 line-clamp-1 text-sm font-black text-foreground">{doc.name}</p>
                <p className="line-clamp-1 text-[11px] font-medium text-muted-foreground">{doc.specs?.[0] ?? "Atendimento médico"}</p>
                <Button size="sm" onClick={() => navigate(`/dashboard/schedule/${doc.id}`)} className="mt-2 h-8 w-full rounded-full text-[11px] font-black">
                  Agendar
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <button
        onClick={() => navigate(healthNudge.path)}
        className="flex w-full items-center gap-4 rounded-[24px] border border-primary/12 bg-gradient-to-br from-primary/[0.06] via-card to-card p-4 text-left shadow-sm transition hover:-translate-y-0.5"
      >
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Heartbeat size={24} weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">{healthNudge.title}</p>
          <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{healthNudge.sub}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <ArrowRight size={16} weight="bold" />
        </span>
      </button>

      <section className="rounded-[28px] border border-border/55 bg-card p-4 shadow-sm md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-black text-foreground">Atividade recente</h2>
          <button onClick={() => navigate("/dashboard/history?role=patient")} className="flex items-center gap-1 text-xs font-black text-primary">
            Ver histórico <ArrowRight size={13} weight="bold" />
          </button>
        </div>
        <div className="grid gap-2">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border/50 bg-background/60 px-4 py-8 text-center">
              <p className="text-sm font-black text-foreground">Nenhuma atividade ainda</p>
              <p className="text-xs text-muted-foreground">Suas consultas, receitas e exames aparecerão aqui.</p>
            </div>
          ) : (
            activities.map((item: any, index: number) => {
              const Icon = item.icon ?? (index === 0 ? FileText : Pill);
              return (
                <button key={item.id ?? item.title ?? index} onClick={() => navigate("/dashboard/history?role=patient")} className="group flex w-full items-center gap-3 rounded-2xl border border-border/40 bg-background p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 transition group-hover:scale-105">
                    <Icon size={20} weight="bold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-foreground">{item.title ?? item.type ?? "Atividade"}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.subtitle ?? item.description ?? "Atualização recente"}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-700">{item.status ?? "Ativa"}</span>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

const HeroSection = ({ firstName, nextAppt, upcoming, stats, getGreeting, getAvatarRingColor, getContextualSubtitle, profile }: any) => (
  <section className={cn("patient-hero relative -mx-4 -mt-5 overflow-hidden rounded-b-[32px] md:-mx-6 md:-mt-5 md:rounded-[2rem] lg:-mx-8 lg:-mt-6 bg-gradient-to-br from-white via-[hsl(210_60%_97%)] to-[hsl(210_70%_94%)] border border-[hsl(215_30%_90%)]/60 dark:border-white/5 dark:bg-[radial-gradient(ellipse_at_top_right,hsl(215_70%_18%)_0%,hsl(220_30%_8%)_55%,hsl(220_25%_6%)_100%)]")} style={{ boxShadow: "0 12px 40px -12px rgba(15, 42, 90, 0.18), inset 0 1px 0 rgba(255,255,255,0.6)" }}>
    <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[hsl(215_85%_60%)]/10 blur-[80px] hidden md:block dark:bg-[hsl(215_85%_55%)]/20" />
    <div className="pointer-events-none absolute -left-8 bottom-4 h-48 w-48 rounded-full bg-[hsl(168_60%_55%)]/10 blur-[60px] hidden md:block dark:bg-[hsl(215_85%_55%)]/15" />
    <div className="relative z-10 px-5 pt-8 pb-7 md:px-8 md:pt-12 md:pb-9 flex flex-col md:flex-row items-center md:items-start gap-4">
      <div className={cn("ring-[3px] ring-offset-2 ring-offset-transparent rounded-full", getAvatarRingColor(nextAppt))}>
        <LazyAvatar src={profile?.avatar_url} name={firstName} className="h-16 w-16 md:h-[72px] md:w-[72px] border-2 border-[hsl(215_30%_90%)] dark:border-white/20" fallbackClassName="bg-[hsl(215_80%_28%)]/10 text-[hsl(215_80%_28%)] dark:bg-white/15 dark:text-white" />
      </div>
      <div className="flex-1 min-w-0 text-center md:text-left">
        <h1 className="font-[Manrope] text-[26px] font-extrabold leading-[1.1] tracking-tight md:text-[38px] text-[hsl(215_80%_18%)] dark:text-white">
          <span className="block text-[11px] md:text-[13px] font-bold uppercase tracking-[0.18em] text-[hsl(215_85%_45%)] dark:text-[hsl(215_90%_70%)] mb-2">{getGreeting()}, {firstName}! 👋</span>
          Sua saúde em um só lugar
        </h1>
        <p className="mt-2 text-[13px] font-medium leading-relaxed md:text-[15px] text-[hsl(215_30%_35%)] dark:text-white/70">{getContextualSubtitle(upcoming, stats)}</p>
      </div>
      <div className="shrink-0 -mt-2 hidden sm:block"><PingoMascot variant="wave" size={120} animate bounce className="drop-shadow-[0_12px_32px_rgba(15,42,90,0.18)] dark:drop-shadow-[0_12px_32px_rgba(0,0,0,0.45)] sm:!w-[130px] sm:!h-[130px]" /></div>
    </div>
    {/* Trust strip */}
    <div className="relative z-10 px-5 pb-5 md:px-8 md:pb-6">
      <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 text-[11px] font-semibold text-[hsl(215_50%_30%)] dark:text-white/70">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> CFM verificado</span>
        <span className="hidden sm:inline opacity-30">·</span>
        <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-500" /> Dados criptografados</span>
        <span className="hidden sm:inline opacity-30">·</span>
        <span className="inline-flex items-center gap-1.5"><Sparkle weight="fill" className="w-3.5 h-3.5 text-amber-500" /> Receita digital válida</span>
      </div>
    </div>
  </section>
);

const QUICK_SPECIALTIES = [
  { label: "Clínico Geral", icon: Stethoscope, query: "Clínico" },
  { label: "Pediatria", icon: Heart, query: "Pediatria" },
  { label: "Saúde Mental", icon: Sparkle, query: "Psiquiatria" },
  { label: "Dermatologia", icon: Heart, query: "Dermatologia" },
];

const DoctorSearchHero = ({ navigate, hasNextAppt }: { navigate: any; hasNextAppt: boolean }) => {
  const [term, setTerm] = useState("");
  const submit = (q?: string) => {
    const value = (q ?? term).trim();
    const path = value
      ? `/dashboard/schedule?role=patient&q=${encodeURIComponent(value)}`
      : "/dashboard/schedule?role=patient";
    navigate(path);
  };
  return (
    <motion.section
      data-tour="search"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
              className="app-card rounded-[30px] border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 md:p-6"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 shrink-0">
          <MagnifyingGlass size={22} weight="fill" className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-lg font-bold text-foreground leading-tight">
            {hasNextAppt ? "Precisa de outro especialista?" : "Encontre um médico em segundos"}
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Médicos verificados pelo CFM.
          </p>
        </div>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Especialidade, sintoma ou nome do médico"
            className="h-12 pl-11 rounded-2xl bg-card/90 border-border/50 text-sm md:text-base shadow-inner transition-all focus-visible:ring-primary/25"
            aria-label="Buscar médico ou especialidade"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-12 rounded-2xl px-6 font-bold shadow-sm gap-1.5 transition-all hover:-translate-y-0.5"
        >
          Buscar <ArrowRight size={16} weight="bold" />
        </Button>
      </form>
      <div className="flex items-center gap-1.5 flex-wrap mt-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mr-1">Rápido:</span>
        {QUICK_SPECIALTIES.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => submit(s.query)}
            className="h-8 px-3 rounded-full text-[12px] font-semibold bg-muted/60 hover:bg-primary/10 hover:text-primary transition-all text-muted-foreground hover:-translate-y-0.5"
          >
            {s.label}
          </button>
        ))}
      </div>
    </motion.section>
  );
};

const UrgentAlerts = ({ nextAppt, minutesUntilNext, waitingAppt, sections, navigate }: any) => (
  <div className="space-y-4">
    <AnimatePresence>
      {nextAppt && minutesUntilNext !== null && minutesUntilNext > 0 && minutesUntilNext <= 60 && (
        <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} className="rounded-2xl bg-emerald-500 text-white p-4 flex items-center gap-3 shadow-lg">
          <div className="animate-pulse w-3 h-3 rounded-full bg-white shrink-0" />
          <div className="flex-1 min-w-0"><p className="font-bold text-[14px]">Sua consulta começa em breve!</p><p className="text-[12px] opacity-90">{nextAppt.doctor_name} · às {format(new Date(nextAppt.scheduled_at), "HH:mm")}</p></div>
          <Button size="sm" onClick={() => navigate(`/dashboard/consultation/${nextAppt.id}`)} className="shrink-0 rounded-full bg-white text-emerald-700 font-bold text-[12px] hover:bg-white/90">Entrar</Button>
        </motion.div>
      )}
    </AnimatePresence>
    {sections.pendingAppt && waitingAppt && <SectionErrorBoundary fallbackTitle="Erro na sala de espera"><PatientWaitingCard appointment={waitingAppt} /></SectionErrorBoundary>}
  </div>
);

const ReturnAppointments = ({ items, navigate }: any) => (
  <div className="app-card overflow-hidden rounded-[26px] border-warning/15 bg-warning/[0.04] p-4">
    <div className="mb-3 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-xl bg-warning/12"><Gift size={14} weight="fill" className="text-warning" /></div><p className="text-[11px] font-bold text-warning uppercase tracking-wide">Retorno Grátis</p></div>
    {items.map((ra: any) => (
      <div key={ra.id} className="card-interactive mb-2 flex items-center justify-between rounded-xl border border-border/10 bg-card p-3 last:mb-0 shadow-sm">
        <div className="flex items-center gap-3"><LazyAvatar name={ra.doctor_name} className="h-9 w-9" fallbackClassName="bg-warning/10 text-warning text-xs" />
          <div className="text-xs"><p className="font-semibold text-foreground">{ra.doctor_name}</p><p className="mt-0.5 text-muted-foreground">Válido até {format(new Date(ra.return_deadline), "dd/MM")}</p></div>
        </div>
        <Button size="sm" className="h-8 rounded-full bg-warning text-warning-foreground hover:bg-warning/90 text-[11px] font-bold" onClick={() => navigate(`/dashboard/schedule/${ra.doctor_id}?return=true&original=${ra.id}`)}>Agendar</Button>
      </div>
    ))}
  </div>
);

const NextAppointmentCard = ({ appt, navigate }: any) => {
  const scheduledAt = new Date(appt.scheduled_at);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="app-card rounded-[32px] p-6 flex flex-col md:flex-row items-center gap-6 relative group overflow-hidden">
      <div aria-hidden="true" className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-100 transition-opacity pointer-events-none"><DotsThreeVertical size={24} className="text-muted-foreground" /></div>
      <div className="flex items-center gap-5 w-full md:w-auto">
        <div className="relative"><LazyAvatar src={appt.doctor_avatar} name={appt.doctor_name} className="h-20 w-20 rounded-full border-4 border-white dark:border-muted shadow-lg" /><div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 border-2 border-white dark:border-muted flex items-center justify-center"><VideoCamera size={12} weight="fill" className="text-white" /></div></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-2 py-0.5 rounded-full">Consulta Presencial</span></div>
          <h4 className="text-xl font-bold text-foreground truncate">{appt.doctor_name}</h4><p className="text-sm text-muted-foreground">{appt.specialty || "Clínico Geral"}</p><p className="text-[11px] text-muted-foreground mt-1">Clínica AloClínica – Unidade Centro</p>
        </div>
      </div>
      <div className="hidden md:block h-16 w-px bg-border/40 mx-2" />
      <div className="flex flex-row md:flex-col items-center md:items-start justify-between md:justify-center gap-1 w-full md:w-32 bg-muted/30 md:bg-transparent p-4 md:p-0 rounded-2xl">
        <div className="flex items-baseline gap-1"><span className="text-3xl font-black text-foreground">{format(scheduledAt, "dd")}</span><span className="text-[13px] font-bold text-muted-foreground uppercase">{format(scheduledAt, "MMM", { locale: ptBR })}</span></div>
        <div className="text-right md:text-left"><p className="text-[13px] font-bold text-foreground capitalize">{format(scheduledAt, "eeee", { locale: ptBR })}</p><p className="text-[13px] text-muted-foreground">{format(scheduledAt, "HH:mm")}</p></div>
      </div>
      <div className="w-full md:w-auto md:ml-auto"><Button variant="outline" className="w-full md:w-auto rounded-2xl border-border/40 hover:bg-muted font-bold text-sm px-8 py-6 h-auto transition-all shadow-sm" onClick={() => navigate("/dashboard/appointments?role=patient")}>Ver detalhes</Button></div>
    </motion.div>
  );
};

const EmptyAppointmentCard = ({ navigate }: any) => (
  <div className="app-card relative rounded-[32px] bg-gradient-to-br from-card via-card to-blue-500/[0.04] p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
    <div className="flex-1 text-center md:text-left">
      <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-3">
        <CalendarCheck size={24} weight="fill" className="text-primary" />
      </div>
      <p className="text-lg md:text-xl font-bold text-foreground mb-2">Sem consultas agendadas</p>
      <p className="text-sm text-muted-foreground max-w-md mb-5 mx-auto md:mx-0">
        Você ainda não tem nenhuma consulta para os próximos dias.
      </p>
      <Button
        onClick={() => navigate("/dashboard/schedule?role=patient")}
        className="rounded-2xl px-8 h-12 font-bold bg-primary text-primary-foreground shadow-lg hover:shadow-xl"
      >
        Agendar primeira consulta
      </Button>
    </div>
    <div className="shrink-0 hidden md:block">
      <PingoMascot variant="reading" size={160} animate className="drop-shadow-[0_12px_28px_rgba(15,42,90,0.18)]" />
    </div>
  </div>
);

export default PatientDashboard;

