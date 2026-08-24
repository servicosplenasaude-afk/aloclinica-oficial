import { useState, useEffect, useMemo } from "react";
import mascotWelcome from "@/assets/states/pingo-agenda-paciente.webp";
import mascotReading from "@/assets/states/pingo-agenda-vazia.webp";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Clock, FileText, Video, Search, Download, Filter, ArrowLeft, MoreHorizontal, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getPatientNav } from "./patientNav";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import CancelRescheduleDialog from "./CancelRescheduleDialog";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface Appointment {
  id: string;
  scheduled_at: string;
  status: string;
  payment_status: string;
  duration_minutes: number | null;
  doctor_id: string;
  doctor_name: string;
  doctor_crm: string;
  specialties: string[];
  refund_status?: "pending" | "approved" | "refunded" | "rejected" | null;
  refund_amount_cents?: number | null;
}

const statusConfig: Record<string, { label: string; color: string; dot: string; stripe: string }> = {
  scheduled: { label: "Agendada", color: "bg-[hsl(var(--p-primary))]/10 text-[hsl(var(--p-primary))]", dot: "bg-[hsl(var(--p-primary))]", stripe: "bg-[hsl(var(--p-primary))]" },
  payment_pending: { label: "Aguardando pagamento", color: "bg-[hsl(var(--p-warning-soft))] text-warning", dot: "bg-warning animate-pulse", stripe: "bg-warning" },
  waiting: { label: "Sala de espera", color: "bg-[hsl(var(--p-warning-soft))] text-warning", dot: "bg-warning", stripe: "bg-warning" },
  in_progress: { label: "Em andamento", color: "bg-secondary/10 text-secondary", dot: "bg-secondary animate-pulse", stripe: "bg-secondary" },
  completed: { label: "Concluída", color: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", stripe: "bg-muted-foreground" },
  cancelled: { label: "Cancelada", color: "bg-[hsl(var(--p-danger-soft))] text-destructive", dot: "bg-destructive", stripe: "bg-destructive" },
  no_show: { label: "Não compareceu", color: "bg-[hsl(var(--p-danger-soft))] text-destructive", dot: "bg-destructive", stripe: "bg-destructive" },
};

const PERIOD_OPTIONS = [
  { value: "all", label: "Todo período" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "last3", label: "Últimos 3 meses" },
  { value: "custom", label: "Personalizado" },
];

const STATUS_CHIPS = [
  { value: "all", label: "Todas" },
  { value: "scheduled", label: "Agendadas" },
  { value: "waiting", label: "Na espera" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluídas" },
  { value: "cancelled", label: "Canceladas" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.3 } }),
};

const AppointmentsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarStep, setCalendarStep] = useState<"from" | "to">("from");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => { if (user) fetchAppointments(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = db
      .channel("patient-appts-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `patient_id=eq.${user.id}` }, () => fetchAppointments())
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [user]);

  const fetchAppointments = async () => {
    setLoading(true);
    const { data } = await db
      .from("appointments")
      .select("id, scheduled_at, status, payment_status, duration_minutes, doctor_id")
      .eq("patient_id", user!.id)
      .order("scheduled_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    const doctorIds = [...new Set(data.map(a => a.doctor_id))];
    const { data: doctors } = await db
      .from("doctor_profiles")
      .select("id, user_id, crm, crm_state")
      .in("id", doctorIds);

    const userIds = doctors?.map(d => d.user_id) ?? [];
    const apptIds = data.map(a => a.id);
    const [profilesRes, specsRes, refundsRes] = await Promise.all([
      db.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds),
      db.from("doctor_specialties").select("doctor_id, specialties(name)").in("doctor_id", doctorIds),
      db.from("refund_requests")
        .select("appointment_id, status, amount_cents, requested_at")
        .in("appointment_id", apptIds)
        .order("requested_at", { ascending: false }),
    ]);

    const doctorMap = new Map(doctors?.map(d => [d.id, d]) ?? []);
    const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) ?? []);
    const specMap = new Map<string, string[]>();
    specsRes.data?.forEach((s: any) => {
      const arr = specMap.get(s.doctor_id) ?? [];
      arr.push(s.specialties?.name ?? "");
      specMap.set(s.doctor_id, arr);
    });
    // Mantém apenas a solicitação mais recente por consulta
    const refundMap = new Map<string, { status: string; amount_cents: number | null }>();
    refundsRes.data?.forEach((r: any) => {
      if (!refundMap.has(r.appointment_id)) {
        refundMap.set(r.appointment_id, { status: r.status, amount_cents: r.amount_cents });
      }
    });

    setAppointments(data.map((a: any) => {
      const doc = doctorMap.get(a.doctor_id) as any;
      const profile = doc ? (profileMap.get(doc.user_id) as any) : null;
      const displayStatus = (a.status === "scheduled" && a.payment_status === "pending") ? "payment_pending" : a.status;
      const refund = refundMap.get(a.id);
      return {
        id: a.id,
        scheduled_at: a.scheduled_at,
        status: displayStatus,
        payment_status: a.payment_status ?? "pending",
        duration_minutes: a.duration_minutes,
        doctor_id: a.doctor_id,
        doctor_name: profile ? `Dr(a). ${profile.first_name} ${profile.last_name}` : "Médico",
        doctor_crm: doc ? `${doc.crm}/${doc.crm_state}` : "",
        specialties: specMap.get(a.doctor_id) ?? [],
        refund_status: (refund?.status as any) ?? null,
        refund_amount_cents: refund?.amount_cents ?? null,
      };
    }));
    setLoading(false);
  };

  const getDateRange = () => {
    const now = new Date();
    if (period === "today") return { start: startOfDay(now), end: endOfDay(now) };
    if (period === "week") return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
    if (period === "month") return { start: startOfMonth(now), end: endOfMonth(now) };
    if (period === "last3") return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    if (period === "custom" && customFrom && customTo) return { start: startOfDay(customFrom), end: endOfDay(customTo) };
    return null;
  };

  const filtered = useMemo(() => {
    const range = getDateRange();
    return appointments.filter(a => {
      const matchSearch = !search || a.doctor_name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || a.status === filterStatus;
      const matchDate = !range || isWithinInterval(new Date(a.scheduled_at), range);
      return matchSearch && matchStatus && matchDate;
    });
  }, [appointments, search, filterStatus, period, customFrom, customTo]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Minhas Consultas", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
    let y = 40;
    filtered.forEach((a, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.text(`${i + 1}. ${a.doctor_name}`, 14, y);
      doc.setFontSize(9);
      doc.text(`Data: ${format(new Date(a.scheduled_at), "dd/MM/yyyy 'às' HH:mm")} | Status: ${statusConfig[a.status]?.label ?? a.status} | Duração: ${a.duration_minutes || 30}min`, 14, y + 6);
      y += 16;
    });
    doc.save(`consultas-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  const exportCSV = () => {
    const rows = [
      ["Médico", "CRM", "Data", "Hora", "Duração", "Status"],
      ...filtered.map(a => [
        a.doctor_name, a.doctor_crm,
        format(new Date(a.scheduled_at), "dd/MM/yyyy"),
        format(new Date(a.scheduled_at), "HH:mm"),
        `${a.duration_minutes || 30}min`,
        statusConfig[a.status]?.label ?? a.status,
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `consultas-${format(new Date(), "yyyy-MM-dd")}.csv`;
    el.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    if (calendarStep === "from") {
      setCustomFrom(date);
      setCalendarStep("to");
    } else {
      setCustomTo(date);
      setCalendarOpen(false);
      setCalendarStep("from");
    }
  };

  const upcoming = filtered.filter(a => ["scheduled", "waiting", "in_progress", "payment_pending"].includes(a.status));
  const past = filtered.filter(a => ["completed", "cancelled", "no_show"].includes(a.status));
  const completedCount = past.filter(a => a.status === "completed").length;
  const paymentPendingCount = appointments.filter(a => a.status === "payment_pending").length;
  const nextAppt = upcoming.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];

  const activeFilterCount = (filterStatus !== "all" ? 1 : 0) + (period !== "all" ? 1 : 0) + (search ? 1 : 0);

  const renderAppointment = (appt: Appointment, i: number) => {
    const config = statusConfig[appt.status] ?? { label: appt.status, color: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", stripe: "bg-muted-foreground" };
    const isActive = ["waiting", "in_progress", "scheduled"].includes(appt.status);
    const scheduledDate = new Date(appt.scheduled_at);

    return (
      <motion.div
        key={appt.id}
        custom={i}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        whileTap={{ scale: 0.97 }}
        className="overflow-hidden rounded-2xl border border-border/20 bg-card shadow-[var(--p-shadow-card)] hover:shadow-[var(--p-shadow-elevated)] transition-shadow"
      >
        <div className="flex">
          {/* Status stripe */}
          <div className={cn("w-1 shrink-0", config.stripe)} />

          <div className="flex-1 p-4">
            <div className="flex items-start gap-3">
              {/* Date pill */}
              <div className="w-14 shrink-0 text-center">
                <div className="bg-[hsl(var(--p-primary))]/8 rounded-xl py-2">
                  <p className="text-[10px] text-[hsl(var(--p-primary))] font-bold uppercase tracking-wider">
                    {format(scheduledDate, "MMM", { locale: ptBR })}
                  </p>
                  <p className="text-xl font-extrabold text-[hsl(var(--p-primary))] leading-none mt-0.5 font-[Manrope]">
                    {format(scheduledDate, "dd")}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 font-medium">{format(scheduledDate, "HH:mm")}h</p>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-[15px] leading-tight truncate">{appt.doctor_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">CRM {appt.doctor_crm} · {appt.duration_minutes || 30}min</p>

                {appt.specialties.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {appt.specialties.slice(0, 2).map(s => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--p-primary))]/8 text-[hsl(var(--p-primary))] font-semibold">{s}</span>
                    ))}
                  </div>
                )}

                {/* Status + actions */}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <span className={cn("flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full", config.color)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
                    {config.label}
                  </span>

                  {appt.status === "cancelled" && appt.refund_status && (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full",
                        appt.refund_status === "refunded" && "bg-emerald-500/15 text-emerald-700",
                        appt.refund_status === "approved" && "bg-blue-500/15 text-blue-700",
                        appt.refund_status === "rejected" && "bg-destructive/15 text-destructive",
                        appt.refund_status === "pending" && "bg-amber-500/15 text-amber-700",
                      )}
                      title={appt.refund_amount_cents != null ? `R$ ${(appt.refund_amount_cents / 100).toFixed(2).replace(".", ",")}` : undefined}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      Reembolso: {
                        appt.refund_status === "pending" ? "Pendente" :
                        appt.refund_status === "approved" ? "Aprovado" :
                        appt.refund_status === "refunded" ? "Reembolsado" :
                        "Rejeitado"
                      }
                    </span>
                  )}

                  {isActive && (
                    <Button
                      size="sm"
                      className="h-8 px-3 rounded-full bg-[hsl(var(--p-primary))] text-white text-xs font-bold gap-1 shadow-[var(--p-shadow-btn)]"
                      onClick={() => navigate(`/dashboard/consultation/${appt.id}`)}
                    >
                      <Video className="w-3.5 h-3.5" /> Entrar
                    </Button>
                  )}

                  {(appt.status === "scheduled" || appt.status === "payment_pending") && (
                    <>
                    {appt.status === "payment_pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 rounded-full text-xs font-semibold gap-1 border-warning/30 text-warning hover:bg-warning/10"
                        onClick={() => navigate(`/dashboard/schedule/${appt.doctor_id}?resume=${appt.id}`)}
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Pagar
                      </Button>
                    )}
                    <CancelRescheduleDialog
                      appointmentId={appt.id}
                      doctorId={appt.doctor_id}
                      scheduledAt={appt.scheduled_at}
                      currentDate={format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      doctorName={appt.doctor_name}
                      onSuccess={fetchAppointments}
                    />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <DashboardLayout title="Paciente" nav={getPatientNav("appointments")}>
      <div className="w-full max-w-5xl mx-auto pb-24 md:pb-6">
        {/* Back */}
        <button
          onClick={() => navigate("/dashboard?role=patient")}
          className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-sm font-semibold text-muted-foreground shadow-sm transition-colors hover:text-foreground active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </button>

        {/* Header */}
        <section className="relative mb-5 overflow-hidden rounded-[30px] border border-white/55 bg-[linear-gradient(135deg,#eef7ff_0%,#ffffff_48%,#fff1f4_100%)] p-5 shadow-[0_24px_70px_-44px_rgba(15,42,90,.65)]">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/16 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-10 h-40 w-40 rounded-full bg-rose-300/12 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-white/75 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-primary shadow-sm">
              <CalendarIcon className="h-3.5 w-3.5" />
              Agenda
            </span>
            <h1 className="font-[Manrope] text-2xl font-black tracking-tight text-foreground md:text-3xl">Minhas Consultas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length} consulta{filtered.length !== 1 ? "s" : ""} · {upcoming.length} próxima{upcoming.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Export menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="h-11 w-11 shrink-0 rounded-2xl border-white/70 bg-white/80 shadow-sm" aria-label="Mais opções">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl">
              <SheetHeader><SheetTitle>Exportar consultas</SheetTitle></SheetHeader>
              <div className="space-y-3 py-4">
                <Button variant="outline" className="w-full h-12 rounded-2xl justify-start gap-3" onClick={exportCSV} disabled={filtered.length === 0}>
                  <Download className="w-5 h-5" /> Exportar CSV
                </Button>
                <Button variant="outline" className="w-full h-12 rounded-2xl justify-start gap-3" onClick={exportPDF} disabled={filtered.length === 0}>
                  <FileText className="w-5 h-5" /> Exportar PDF
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* KPI strip */}
        {!loading && (
          <div className="relative mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/65 bg-white/82 p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--p-primary))]">
                <Clock className="w-3 h-3" /> Próxima
              </div>
              <p className="text-sm font-extrabold text-foreground mt-1 truncate">
                {nextAppt ? format(new Date(nextAppt.scheduled_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/65 bg-white/82 p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> Concluídas
              </div>
              <p className="text-sm font-extrabold text-foreground mt-1">{completedCount}</p>
            </div>
            <div className={cn(
              "rounded-2xl border p-3 shadow-sm",
              paymentPendingCount > 0 ? "border-warning/40 bg-warning/10" : "border-white/65 bg-white/82"
            )}>
              <div className={cn(
                "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider",
                paymentPendingCount > 0 ? "text-warning" : "text-muted-foreground"
              )}>
                <AlertCircle className="w-3 h-3" /> Pagto. pendente
              </div>
              <p className="text-sm font-extrabold text-foreground mt-1">{paymentPendingCount}</p>
            </div>
          </div>
        )}
        </section>

        {/* Search */}
        <div className="mb-4 flex gap-2 rounded-[24px] border border-border/45 bg-card p-2 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar médico..."
              aria-label="Buscar consulta por médico"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-2xl text-sm bg-muted/35 border-transparent focus:border-[hsl(var(--p-primary))]/30"
            />
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl shrink-0 relative" aria-label="Filtrar">
                <Filter className="w-4.5 h-4.5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[hsl(var(--p-primary))] text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto">
              <SheetHeader><SheetTitle>Filtros</SheetTitle></SheetHeader>
              <div className="space-y-5 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Período</p>
                  <Select value={period} onValueChange={v => { setPeriod(v); if (v === "custom") setCalendarOpen(true); }}>
                    <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="Período" /></SelectTrigger>
                    <SelectContent>
                      {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {period === "custom" && (
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-11 rounded-2xl mt-2 w-full text-sm">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {customFrom && customTo
                            ? `${format(customFrom, "dd/MM")} → ${format(customTo, "dd/MM")}`
                            : calendarStep === "from" ? "Selecione início" : "Selecione fim"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <p className="text-xs text-muted-foreground px-3 pt-3 pb-1">
                          {calendarStep === "from" ? "Data inicial" : "Data final"}
                        </p>
                        <Calendar
                          mode="single"
                          selected={calendarStep === "from" ? customFrom : customTo}
                          onSelect={handleCalendarSelect}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 h-11 rounded-2xl" onClick={() => { setFilterStatus("all"); setPeriod("all"); setSearch(""); }}>
                    Limpar
                  </Button>
                  <Button className="flex-1 h-11 rounded-2xl bg-[hsl(var(--p-primary))] text-white" onClick={() => setFiltersOpen(false)}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Status filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-5 scrollbar-hide -mx-1 px-1">
          {STATUS_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => setFilterStatus(chip.value)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95",
                filterStatus === chip.value
                  ? "bg-[hsl(var(--p-primary))] text-white shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Upcoming */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2 font-[Manrope]">
            <Clock className="w-4 h-4 text-[hsl(var(--p-primary))]" /> Próximas ({upcoming.length})
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-2xl border border-border/20">
                  <Skeleton className="w-14 h-16 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-7 w-24 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="relative overflow-hidden rounded-[28px] border border-border/45 bg-card px-5 py-8 text-center shadow-sm">
              <div className="pointer-events-none absolute inset-x-10 top-6 h-24 rounded-full bg-primary/10 blur-3xl" />
              <img src={mascotWelcome} alt="Pingo" className="relative w-24 h-24 object-contain mx-auto drop-shadow-md mb-3 select-none" loading="lazy" decoding="async" width={96} height={96} />
              <p className="text-[13px] font-semibold text-foreground mb-1">Nenhuma consulta próxima</p>
              <p className="text-[11px] text-muted-foreground mb-3">Agende agora e cuide da sua saúde</p>
              <Button size="sm" className="relative rounded-full bg-[hsl(var(--p-primary))] px-5 text-white shadow-[var(--p-shadow-btn)]" onClick={() => navigate("/dashboard/schedule")}>
                Agendar consulta
              </Button>
            </div>
          ) : (
            <div className="space-y-3">{upcoming.map((a, i) => renderAppointment(a, i))}</div>
          )}
        </div>

        {/* History */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2 font-[Manrope]">
            <FileText className="w-4 h-4 text-muted-foreground" /> Histórico ({past.length})
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-2xl border border-border/20">
                  <Skeleton className="w-14 h-16 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : past.length === 0 ? (
            <div className="relative overflow-hidden rounded-[28px] border border-border/45 bg-card px-5 py-8 text-center shadow-sm">
              <div className="pointer-events-none absolute inset-x-10 top-6 h-24 rounded-full bg-muted blur-3xl" />
              <img src={mascotReading} alt="Pingo" className="relative w-24 h-24 object-contain mx-auto drop-shadow-md mb-3 select-none" loading="lazy" decoding="async" width={96} height={96} />
              <p className="text-[13px] font-semibold text-foreground mb-1">Nenhuma consulta no histórico</p>
              <p className="text-[11px] text-muted-foreground">Suas consultas realizadas aparecerão aqui</p>
            </div>
          ) : (
            <div className="space-y-3">{past.map((a, i) => renderAppointment(a, i))}</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AppointmentsList;
