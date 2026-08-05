import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { format, formatDistanceToNow, isAfter, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getDoctorNav } from "./doctorNav";
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  FileText,
  HeartPulse,
  MessageCircle,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import doctorAppHero from "@/assets/doctor-app-command-center.png";
import mascotWelcome from "@/assets/mascot-welcome.png";

interface Patient {
  user_id: string;
  first_name: string;
  last_name: string;
  total_appointments: number;
  last_appointment: string;
}

function initials(patient: Patient) {
  return `${patient.first_name?.[0] ?? "P"}${patient.last_name?.[0] ?? ""}`.toUpperCase();
}

function patientName(patient: Patient) {
  const name = `${patient.first_name} ${patient.last_name}`.trim();
  return name || "Paciente sem nome";
}

function patientLastDate(patient: Patient) {
  return patient.last_appointment ? new Date(patient.last_appointment) : null;
}

function PatientCard({
  patient,
  index,
  active,
  onOpen,
  onFocus,
  onSchedule,
  onMessage,
}: {
  patient: Patient;
  index: number;
  active: boolean;
  onOpen: () => void;
  onFocus: () => void;
  onSchedule: () => void;
  onMessage: () => void;
}) {
  const lastDate = patientLastDate(patient);
  const recent = lastDate ? isAfter(lastDate, subDays(new Date(), 45)) : false;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ delay: index * 0.035, duration: 0.24 }}
      whileTap={{ scale: 0.99 }}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      className={[
        "group rounded-3xl border bg-card p-4 shadow-sm transition-all duration-200",
        active ? "border-emerald-300/70 shadow-[0_16px_36px_-28px_rgba(16,185,129,0.9)]" : "border-border/60 hover:border-emerald-300/70",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 rounded-2xl ring-1 ring-border/60">
          <AvatarFallback className="rounded-2xl bg-emerald-50 text-sm font-black text-emerald-700">
            {initials(patient)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-black leading-5 text-foreground">{patientName(patient)}</h3>
              <p className="mt-1 line-clamp-1 text-xs font-medium text-muted-foreground">
                {lastDate ? formatDistanceToNow(lastDate, { addSuffix: true, locale: ptBR }) : "Sem consulta registrada"}
              </p>
            </div>
            <Badge
              variant="outline"
              className={[
                "h-7 shrink-0 rounded-full px-2.5 text-[10px] font-black uppercase tracking-[0.08em]",
                recent ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
              ].join(" ")}
            >
              {recent ? "ativo" : "revisar"}
            </Badge>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-lg font-black leading-none text-foreground">{patient.total_appointments}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">consultas</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={onSchedule}
                aria-label="Agendar retorno"
                title="Agendar retorno"
                className="h-10 w-10 rounded-2xl"
              >
                <CalendarPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onMessage}
                aria-label="Mensagem"
                title="Mensagem"
                className="h-10 w-10 rounded-2xl"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={onOpen} className="h-10 rounded-2xl px-3 text-xs font-black">
                Prontuario
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

const DoctorPatients = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [doctorProfileId, setDoctorProfileId] = useState<string | null>(null);
  // Diálogo de "Agendar retorno" (antes o botão só navegava p/ um calendário
  // read-only que ignorava o paciente — não criava nada).
  const [returnPatient, setReturnPatient] = useState<Patient | null>(null);
  const [returnDate, setReturnDate] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [savingReturn, setSavingReturn] = useState(false);

  useEffect(() => {
    if (user) fetchPatients();
  }, [user]);

  const fetchPatients = async () => {
    setLoading(true);
    const { data: doc } = await db
      .from("doctor_profiles")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    if (!doc) {
      setLoading(false);
      return;
    }
    setDoctorProfileId(doc.id);

    const { data: appts } = await db
      .from("appointments")
      .select("patient_id, scheduled_at")
      .eq("doctor_id", doc.id)
      .order("scheduled_at", { ascending: false });

    if (!appts || appts.length === 0) {
      setPatients([]);
      setLoading(false);
      return;
    }

    const patientMap = new Map<string, { count: number; lastDate: string }>();
    appts.forEach((appointment) => {
      const patientId = appointment.patient_id ?? "";
      if (!patientId) return;
      const existing = patientMap.get(patientId);
      if (!existing) {
        patientMap.set(patientId, { count: 1, lastDate: appointment.scheduled_at });
      } else {
        existing.count += 1;
      }
    });

    const patientIds = [...patientMap.keys()];
    const { data: profiles } = await db
      .from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", patientIds);

    const results: Patient[] = patientIds.map((patientId) => {
      const profile = profiles?.find((item) => item.user_id === patientId);
      const info = patientMap.get(patientId)!;
      return {
        user_id: patientId,
        first_name: profile?.first_name ?? "",
        last_name: profile?.last_name ?? "",
        total_appointments: info.count,
        last_appointment: info.lastDate,
      };
    });

    setPatients(results);
    setFocusedId(results[0]?.user_id ?? null);
    setLoading(false);
  };

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return patients.filter((patient) => patientName(patient).toLowerCase().includes(term));
  }, [patients, search]);

  const focusedPatient = filteredPatients.find((patient) => patient.user_id === focusedId) ?? filteredPatients[0] ?? null;
  const totalAppointments = patients.reduce((total, patient) => total + patient.total_appointments, 0);
  const activePatients = patients.filter((patient) => {
    const date = patientLastDate(patient);
    return date ? isAfter(date, subDays(new Date(), 45)) : false;
  }).length;
  const lastPatientDate = patients
    .map(patientLastDate)
    .filter(Boolean)
    .sort((a, b) => b!.getTime() - a!.getTime())[0];

  const openPatient = (patient: Patient) => navigate(`/dashboard/patients/${patient.user_id}/emr?role=doctor`);
  // Agendar retorno: abre um diálogo p/ escolher data/hora e cria o retorno de fato.
  const scheduleReturn = (patient: Patient) => { setReturnPatient(patient); setReturnDate(""); setReturnNote(""); };

  const submitReturn = async () => {
    if (!doctorProfileId || !returnPatient) return;
    if (!returnDate) { toast.error("Escolha a data e o horário do retorno."); return; }
    const scheduledAt = new Date(returnDate);
    if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
      toast.error("Escolha uma data e horário futuros."); return;
    }
    setSavingReturn(true);
    const { error } = await db.from("appointments").insert({
      doctor_id: doctorProfileId,
      patient_id: returnPatient.user_id,
      scheduled_at: scheduledAt.toISOString(),
      appointment_type: "retorno",
      status: "scheduled",
      notes: returnNote.trim() || null,
    } as any);
    if (error) { setSavingReturn(false); toast.error("Erro ao agendar retorno", { description: error.message }); return; }
    // Notifica o paciente (não bloqueia o sucesso).
    await db.from("notifications").insert({
      user_id: returnPatient.user_id,
      type: "appointment",
      title: "🗓️ Retorno agendado",
      message: `Seu médico agendou um retorno para ${format(scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR })}.`,
      link: "/dashboard/appointments",
    } as any).catch(() => {});
    setSavingReturn(false);
    toast.success("Retorno agendado!", { description: "O paciente foi notificado." });
    setReturnPatient(null);
    fetchPatients();
  };
  // Mensagem: abre o chat do médico (inbox) — mesmo padrão usado no restante do app
  const messagePatient = (_patient: Patient) => navigate(`/dashboard/chat?role=doctor`);

  const stats = [
    { label: "Pacientes", value: patients.length, icon: Users },
    { label: "Ativos", value: activePatients, icon: HeartPulse },
    { label: "Consultas", value: totalAppointments, icon: CalendarDays },
    { label: "Prontuarios", value: patients.length, icon: FileText },
  ];

  return (
    <DashboardLayout title="Pacientes" nav={getDoctorNav("patients")}>
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-24 md:pb-8">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-sm"
        >
          <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <UserRoundCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">App medico</p>
                  <h1 className="truncate text-2xl font-black tracking-tight text-foreground sm:text-3xl">Pacientes</h1>
                </div>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                Carteira organizada para acompanhar historico, recorrencia e acesso rapido ao prontuario.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {stats.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl border border-border/55 bg-background/70 p-3">
                      <Icon className="mb-3 h-4 w-4 text-emerald-700" />
                      <p className="text-2xl font-black leading-none text-foreground tabular-nums">{loading ? "..." : item.value}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-border/60 bg-muted/25 p-4 sm:p-6 lg:border-l lg:border-t-0">
              <div className="relative mb-4 overflow-hidden rounded-3xl border border-border/50 bg-background">
                <img src={doctorAppHero} alt="" className="h-28 w-full object-cover opacity-80" loading="lazy" decoding="async" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                <img src={mascotWelcome} alt="Pingo" className="absolute bottom-2 right-3 h-16 w-16 object-contain drop-shadow-md" />
              </div>

              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Buscar paciente</label>
              <div className="relative mt-2">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nome do paciente"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-12 rounded-2xl pl-10"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-border/50 bg-background/80 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Ultima atividade</p>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {lastPatientDate ? format(lastPatientDate, "dd/MM/yyyy", { locale: ptBR }) : "Sem atendimentos ainda"}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Carteira</p>
                <h2 className="truncate text-xl font-black tracking-tight text-foreground">
                  {loading ? "Carregando..." : `${filteredPatients.length} paciente${filteredPatients.length === 1 ? "" : "s"}`}
                </h2>
              </div>
              {search && (
                <Button variant="outline" size="sm" className="h-9 rounded-2xl text-xs font-bold" onClick={() => setSearch("")}>
                  Limpar
                </Button>
              )}
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="h-32 animate-pulse rounded-3xl border border-border/50 bg-muted/50" />
                ))}
              </div>
            ) : filteredPatients.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[28px] border border-border/60 bg-card p-6 text-center shadow-sm sm:p-8"
              >
                <img src={mascotWelcome} alt="Pingo" className="mx-auto mb-4 h-20 w-20 object-contain" />
                {search.trim() ? (
                  <>
                    <h3 className="text-lg font-black text-foreground">Nenhum paciente encontrado</h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                      Revise o nome digitado ou limpe a busca para ver toda a carteira.
                    </p>
                    <Button className="mt-5 h-11 rounded-2xl font-bold" onClick={() => setSearch("")}>Limpar busca</Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-black text-foreground">Carteira vazia</h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                      Os pacientes aparecem aqui depois das primeiras consultas concluidas.
                    </p>
                    <div className="mt-5 grid gap-2 sm:flex sm:justify-center">
                      <Button className="h-11 rounded-2xl font-bold" onClick={() => navigate("/dashboard/availability?role=doctor")}>Configurar agenda</Button>
                      <Button variant="outline" className="h-11 rounded-2xl font-bold" onClick={() => navigate("/dashboard/doctor/calendar?role=doctor")}>Ver calendario</Button>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <AnimatePresence mode="popLayout">
                  {filteredPatients.map((patient, index) => (
                    <PatientCard
                      key={patient.user_id}
                      patient={patient}
                      index={index}
                      active={focusedPatient?.user_id === patient.user_id}
                      onFocus={() => setFocusedId(patient.user_id)}
                      onOpen={() => openPatient(patient)}
                      onSchedule={() => scheduleReturn(patient)}
                      onMessage={() => messagePatient(patient)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          <aside className="space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className="rounded-[28px] border border-border/60 bg-card p-4 shadow-sm lg:sticky lg:top-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Em foco</p>
                  <h3 className="mt-1 truncate text-lg font-black text-foreground">{focusedPatient ? patientName(focusedPatient) : "Nenhum paciente"}</h3>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              {focusedPatient ? (
                <>
                  <div className="mt-4 rounded-2xl border border-border/50 bg-muted/30 p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 rounded-2xl">
                        <AvatarFallback className="rounded-2xl bg-emerald-50 text-sm font-black text-emerald-700">
                          {initials(focusedPatient)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{patientName(focusedPatient)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {patientLastDate(focusedPatient) ? format(patientLastDate(focusedPatient)!, "dd/MM/yyyy", { locale: ptBR }) : "Sem data"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button className="mt-4 h-11 w-full rounded-2xl font-black" onClick={() => openPatient(focusedPatient)}>
                    Abrir prontuario
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-11 rounded-2xl text-xs font-bold" onClick={() => scheduleReturn(focusedPatient)}>
                      <CalendarPlus className="mr-1.5 h-4 w-4" />
                      Retorno
                    </Button>
                    <Button variant="outline" className="h-11 rounded-2xl text-xs font-bold" onClick={() => messagePatient(focusedPatient)}>
                      <MessageCircle className="mr-1.5 h-4 w-4" />
                      Mensagem
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  Selecione um paciente para abrir o resumo e acessar o prontuario.
                </p>
              )}
            </motion.div>
          </aside>
        </div>
      </div>

      {/* Diálogo: Agendar retorno */}
      <Dialog open={!!returnPatient} onOpenChange={(o) => { if (!o) setReturnPatient(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar retorno{returnPatient ? ` — ${patientName(returnPatient)}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Data e horário</Label>
              <Input type="datetime-local" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Observação (opcional)</Label>
              <Input value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="Ex.: reavaliar exames" className="mt-1" />
            </div>
            <p className="text-xs text-muted-foreground">O paciente será notificado do retorno agendado.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnPatient(null)} disabled={savingReturn}>Cancelar</Button>
            <Button onClick={submitReturn} disabled={savingReturn}>
              <CalendarPlus className="w-4 h-4 mr-1.5" /> {savingReturn ? "Agendando…" : "Agendar retorno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DoctorPatients;
