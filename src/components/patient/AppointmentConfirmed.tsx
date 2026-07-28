import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { CheckCircle2, Calendar, Clock, Video, ArrowRight, Stethoscope, Download, Home, ListChecks, Loader2, Copy, Wifi, Mic, Camera, FileText, Receipt, RefreshCw, X, ShieldCheck, AlertTriangle, Info, BellRing, ChevronDown, Check, Mail, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getPatientNav } from "./patientNav";
import CancelRescheduleDialog from "./CancelRescheduleDialog";
import { validateIcs, logIcsValidation } from "@/lib/icsValidator";

interface ConfirmedAppointment {
  id: string;
  scheduled_at: string;
  appointment_type: string;
  price_at_booking: number | null;
  payment_status: string | null;
  status: string | null;
  doctor_id: string;
  doctor_name: string;
  doctor_specialty: string | null;
  doctor_crm: string | null;
  doctor_crm_state: string | null;
  duration_minutes: number;
  clinic_id: string | null;
  clinic_name: string | null;
  patient_name: string | null;
  patient_email: string | null;
}

const formatBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

// Formata Date para horário local de São Paulo no formato ICS (YYYYMMDDTHHMMSS)
const fmtLocalSP = (d: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
};

// UTC no formato ICS (YYYYMMDDTHHMMSSZ) — usado em DTSTAMP
const fmtUtc = (d: Date) =>
  d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

const escapeIcs = (s: string) =>
  String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

// UFs válidas (CFM emite registros vinculados a um conselho estadual).
const UF_LIST = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]);

/**
 * Valida e formata o CRM no padrão CFM: "CRM/UF NNNNNN".
 * - Aceita variações sujas vindas do cadastro (com pontos, traços, "CRM" no meio, etc.).
 * - Exige 4–7 dígitos e UF válida; caso contrário retorna `null` para o caller omitir do .ics.
 */
export const formatCrm = (
  raw: string | null | undefined,
  state: string | null | undefined
): string | null => {
  const uf = String(state ?? "").trim().toUpperCase();
  if (!UF_LIST.has(uf)) return null;
  const digits = String(raw ?? "").replace(/\D+/g, "");
  if (digits.length < 4 || digits.length > 7) return null;
  // Remove zeros à esquerda preservando ao menos um dígito.
  const num = digits.replace(/^0+(?=\d)/, "");
  return `CRM/${uf} ${num}`;
};

const buildIcsText = (appt: ConfirmedAppointment, roomUrl: string, reminderMinutes: number | null) => {
  const start = new Date(appt.scheduled_at);
  const duration = Math.max(5, Number(appt.duration_minutes) || 30);
  const end = new Date(start.getTime() + duration * 60 * 1000);

  // Bloco VTIMEZONE para America/Sao_Paulo (UTC-3, sem DST desde 2019)
  const vtimezone = [
    "BEGIN:VTIMEZONE",
    "TZID:America/Sao_Paulo",
    "X-LIC-LOCATION:America/Sao_Paulo",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0300",
    "TZNAME:-03",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  const crmLabel = formatCrm(appt.doctor_crm, appt.doctor_crm_state);
  const crmSuffix = crmLabel ? ` — ${crmLabel}` : "";
  const specSuffix = appt.doctor_specialty ? ` (${appt.doctor_specialty})` : "";

  const patientInfo = appt.patient_name
    ? `Paciente: ${appt.patient_name}${appt.patient_email ? ` (${appt.patient_email})` : ""}\n`
    : "";

  const description = escapeIcs(
    `Consulta online AloClínica\n` +
    `${patientInfo}` +
    `Médico: ${appt.doctor_name}${specSuffix}${crmSuffix}.\n` +
    `Duração: ${duration} minutos.\n` +
    `Link da sala: ${roomUrl}\n` +
    `Entre 5 minutos antes para testar câmera e microfone.`
  );

  // X-ALT-DESC com HTML para clients que suportam (Outlook, Apple Calendar)
  const htmlDesc = escapeIcs(
    `<h3>Consulta online AloClínica</h3>` +
    `${appt.patient_name ? `<p><b>Paciente:</b> ${appt.patient_name}${appt.patient_email ? ` (${appt.patient_email})` : ""}</p>` : ""}` +
    `<p><b>Médico:</b> ${appt.doctor_name}${specSuffix}${crmSuffix}</p>` +
    `<p><b>Duração:</b> ${duration} minutos</p>` +
    `<p><b>Link da sala:</b> <a href="${roomUrl}">${roomUrl}</a></p>` +
    `<p>Entre 5 minutos antes para testar câmera e microfone.</p>`
  );

  const alarm = reminderMinutes != null && reminderMinutes > 0
    ? [
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:Sua teleconsulta começa em ${reminderMinutes >= 60 ? `${reminderMinutes / 60} h` : `${reminderMinutes} minutos`}`,
        `TRIGGER:-PT${reminderMinutes}M`,
        "END:VALARM",
      ]
    : [];

  const locationLabel = appt.clinic_name
    ? `${appt.clinic_name} — Teleconsulta Online | ${roomUrl}`
    : `AloClínica — Teleconsulta Online | ${roomUrl}`;

  const attendeeBlock = appt.patient_email
    ? [`ATTENDEE;ROLE=REQ-PARTICIPANT;CN=${escapeIcs(appt.patient_name || "Paciente")}:mailto:${appt.patient_email}`]
    : [];

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AloClinica//Telemedicina//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vtimezone,
    "BEGIN:VEVENT",
    `UID:${appt.id}@aloclinica`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART;TZID=America/Sao_Paulo:${fmtLocalSP(start)}`,
    `DTEND;TZID=America/Sao_Paulo:${fmtLocalSP(end)}`,
    `DURATION:PT${duration}M`,
    `SUMMARY:${escapeIcs(`Teleconsulta — ${appt.doctor_name}${specSuffix}${crmLabel ? `, ${crmLabel}` : ""}`)}`,
    `DESCRIPTION:${description}`,
    `X-ALT-DESC;FMTTYPE=text/html:${htmlDesc}`,
    `URL:${roomUrl}`,
    `LOCATION:${escapeIcs(locationLabel)}`,
    ...attendeeBlock,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    ...alarm,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return ics;
};


const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Sem lembrete" },
  { value: 5, label: "5 minutos antes" },
  { value: 10, label: "10 minutos antes" },
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 1440, label: "1 dia antes" },
];

const REMINDER_STORAGE_KEY = "alo_ics_reminder_minutes";

const AppointmentConfirmed = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [appt, setAppt] = useState<ConfirmedAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(() => {
    if (typeof window === "undefined") return 15;
    const raw = window.localStorage.getItem(REMINDER_STORAGE_KEY);
    if (raw === null) return 15;
    if (raw === "none") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 15;
  });
  const persistReminder = (v: number | null) => {
    setReminderMinutes(v);
    try {
      window.localStorage.setItem(REMINDER_STORAGE_KEY, v == null ? "none" : String(v));
    } catch { /* noop */ }
  };
  const nav = getPatientNav("appointments");

  // Tick a cada 30s para reavaliar a janela de entrada na sala
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchAppt = async () => {
      if (!appointmentId) return;
      const { data } = await db
        .from("appointments")
        .select("id, scheduled_at, appointment_type, price_at_booking, payment_status, status, doctor_id, clinic_id, patient_id")
        .eq("id", appointmentId)
        .maybeSingle();

      if (!data) {
        setLoading(false);
        return;
      }

      // Buscar médico via view pública
      const { data: doc } = await db
        .from("doctor_profiles_public" as any)
        .select("display_name, full_name, crm, crm_state, specialty_names, consultation_duration")
        .eq("id", data.doctor_id)
        .maybeSingle();

      // Buscar nome da clínica/centro de atendimento
      let clinicName: string | null = null;
      if (data.clinic_id) {
        const { data: clinic } = await db
          .from("clinic_profiles")
          .select("name")
          .eq("id", data.clinic_id)
          .maybeSingle();
        clinicName = (clinic as any)?.name ?? null;
      }

      // Buscar dados do paciente (nome e e-mail)
      let patientName: string | null = null;
      let patientEmail: string | null = null;
      if (data.patient_id) {
        const { data: patientProfile } = await db
          .from("profiles")
          .select("first_name, last_name, user_id")
          .eq("user_id", data.patient_id)
          .maybeSingle();
        if (patientProfile) {
          const p = patientProfile as any;
          patientName = [p.first_name, p.last_name].filter(Boolean).join(" ") || null;
        }
        // E-mail do próprio paciente, da SESSÃO ATUAL (auth.admin não funciona no
        // cliente — antes retornava null + 403). Quem vê esta tela é o paciente da
        // consulta, então o e-mail sai da sessão dele quando o id bate.
        const { data: authData } = await db.auth.getUser();
        if (authData?.user?.id === data.patient_id) {
          patientEmail = authData.user.email ?? null;
        }
      }

      const docAny = doc as any;
      setAppt({
        ...data,
        doctor_name: docAny?.display_name || docAny?.full_name || "Médico AloClínica",
        doctor_specialty: docAny?.specialty_names?.[0] ?? null,
        doctor_crm: docAny?.crm ?? null,
        doctor_crm_state: docAny?.crm_state ?? null,
        duration_minutes: Number(docAny?.consultation_duration) || 30,
        clinic_id: data.clinic_id ?? null,
        clinic_name: clinicName,
        patient_name: patientName,
        patient_email: patientEmail,
      });
      setLoading(false);
    };
    fetchAppt();
  }, [appointmentId]);

  if (loading) {
    return (
      <DashboardLayout title="Confirmação" nav={nav}>
        <div className="w-full max-w-xl mx-auto pb-24 md:pb-6" aria-label="Carregando confirmação">
          <Skeleton className="h-64 w-full rounded-[30px]" />
          <div className="mt-6 space-y-3">
            <Skeleton className="h-5 w-2/3 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-5/6 rounded-lg" />
            <Skeleton className="h-11 w-full rounded-xl mt-4" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!appt) {
    return (
      <DashboardLayout title="Confirmação" nav={nav}>
        <div className="text-center py-20">
          <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <h2 className="text-lg font-bold mb-1">Consulta não encontrada</h2>
          <p className="text-sm text-muted-foreground mb-6">Verifique seus agendamentos.</p>
          <Button onClick={() => navigate("/dashboard/appointments")} className="rounded-xl">
            <ListChecks className="w-4 h-4 mr-2" /> Ver minhas consultas
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const date = new Date(appt.scheduled_at);
  const isPaid = ["approved", "confirmed", "received", "paid"].includes(String(appt.payment_status));
  const minutesUntil = Math.round((date.getTime() - now) / 60000);
  const canJoinSoon = minutesUntil <= 15 && minutesUntil >= -120;
  const canReschedule = minutesUntil >= 120; // até 2h antes
  const hoursUntil = minutesUntil / 60;
  // Regras de reembolso (em horas até a consulta):
  // >= 24h: reembolso integral (100%)
  // 2h–24h: reembolso parcial (50%) — taxa de remarcação
  // < 2h: sem reembolso e sem remarcação online
  const refundTier: "full" | "partial" | "none" =
    hoursUntil >= 24 ? "full" : hoursUntil >= 2 ? "partial" : "none";
  const joinLabel = canJoinSoon
    ? "Entrar na sala da consulta"
    : minutesUntil > 15
      ? `Sala abre em ${
          minutesUntil >= 60
            ? `${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}min`
            : `${minutesUntil} min`
        }`
      : "Consulta encerrada";
  const roomUrl = `${window.location.origin}/dashboard/consultation/${appt.id}`;

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      toast.success("Link da consulta copiado!");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const handleDownloadIcs = () => {
    const ics = buildIcsText(appt, roomUrl, reminderMinutes);
    const result = validateIcs(ics);
    logIcsValidation(`consulta-${appt.id}.ics`, ics, result);

    if (!result.ok) {
      toast.error("Arquivo .ics inválido", {
        description: result.errors.slice(0, 2).join(" • "),
      });
      return;
    }

    // Usa Blob + objectURL — mais confiável que data: URI no Safari/iOS para .ics
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consulta-${appt.id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    if (result.warnings.length) {
      toast.success("Agenda baixada", {
        description: `Com link da sala e lembrete. ${result.warnings.length} aviso(s) no console.`,
      });
    } else {
      toast.success("Agenda baixada", {
        description: "Link da sala incluso — abra direto do Google Calendar ou iCal.",
      });
    }
  };

  return (
    <DashboardLayout title="Consulta confirmada" nav={nav}>
      <div className="w-full max-w-xl mx-auto pb-24 md:pb-6">
        {/* Hero check */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 18 }}
          className="flex flex-col items-center text-center py-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 260 }}
            className="relative mb-5"
          >
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
            </div>
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
            {isPaid ? "Consulta confirmada!" : "Reserva criada!"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            {isPaid
              ? "Seu pagamento foi aprovado. Você receberá um lembrete antes do horário."
              : "Finalize o pagamento em até 30 minutos para garantir sua vaga."}
          </p>
        </motion.div>

        {/* Appointment summary card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card variant="elevated" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-5 border-b border-border/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-primary mb-1">Sua teleconsulta</p>
                    <h2 className="font-bold text-foreground text-lg leading-tight">{appt.doctor_name}</h2>
                    {appt.doctor_specialty && (
                      <p className="text-xs text-muted-foreground mt-0.5">{appt.doctor_specialty}</p>
                    )}
                    {appt.doctor_crm && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">CRM {appt.doctor_crm_state} {appt.doctor_crm}</p>
                    )}
                  </div>
                  <Badge className={isPaid
                    ? "bg-emerald-500/15 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                    : "bg-amber-500/15 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                  }>
                    {isPaid ? "Pago" : "Aguardando pagamento"}
                  </Badge>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Data</p>
                    <p className="text-sm font-semibold text-foreground capitalize">
                      {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Horário</p>
                    <p className="text-sm font-semibold text-foreground">{format(date, "HH:mm", { locale: ptBR })}h</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Video className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Modalidade</p>
                    <p className="text-sm font-semibold text-foreground">Vídeo · criptografado</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Valor</span>
                  <span className="text-lg font-black text-foreground tabular-nums">
                    {formatBRL(appt.price_at_booking)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pre-consultation CTA — coleta informações para o médico antes da consulta */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">Adiante sua consulta</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Conte o motivo da consulta e seus sintomas. O médico se prepara antes da chamada e vocês ganham tempo.
                  </p>
                  <Button
                    className="mt-3 w-full sm:w-auto h-10 rounded-xl font-semibold gap-2"
                    onClick={() => navigate(`/dashboard/pre-consultation/${appt.id}`)}
                  >
                    <FileText className="w-4 h-4" /> Preencher formulário pré-consulta
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 space-y-2.5"
        >
          {isPaid && (
            <Button
              className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold shadow-md"
              onClick={() => navigate(`/dashboard/consultation/${appt.id}`)}
              disabled={!canJoinSoon}
            >
              <Video className="w-4 h-4 mr-2" />
              {joinLabel}
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          )}

          <Button
            variant={isPaid ? "outline" : "default"}
            className={`w-full h-12 rounded-xl font-bold ${isPaid ? "" : "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-md"}`}
            onClick={() => navigate(`/dashboard/appointments`)}
          >
            <ListChecks className="w-4 h-4 mr-2" /> Ver minhas consultas
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Button>

          <div className="grid grid-cols-3 gap-2.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-11 rounded-xl">
                  <Download className="w-4 h-4 mr-1.5" /> Agenda
                  <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-3">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <BellRing className="w-3.5 h-3.5 text-primary" /> Lembrete antes da consulta
                </Label>
                <div className="mt-2 max-h-56 overflow-auto -mx-1 px-1">
                  {REMINDER_OPTIONS.map((opt) => {
                    const selected = opt.value === reminderMinutes;
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => persistReminder(opt.value)}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors ${
                          selected ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {selected && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
                <Button onClick={handleDownloadIcs} className="w-full h-10 mt-3 rounded-lg">
                  <Download className="w-4 h-4 mr-2" /> Baixar .ics
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-10 mt-2 rounded-lg"
                  onClick={async () => {
                    const t = toast.loading("Reenviando agenda por e-mail...");
                    const { error } = await db.functions.invoke("appointment-confirmed", {
                      body: { appointment_id: appt.id, resend_only: true },
                    });
                    toast.dismiss(t);
                    if (error) toast.error("Não foi possível reenviar a agenda");
                    else toast.success("Agenda reenviada para o seu e-mail!");
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" /> Reenviar por e-mail
                </Button>
              </PopoverContent>
            </Popover>
            <Button variant="outline" className="h-11 rounded-xl" onClick={copyRoomLink}>
              <Copy className="w-4 h-4 mr-1.5" /> Copiar link
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => navigate("/dashboard")}>
              <Home className="w-4 h-4 mr-1.5" /> Início
            </Button>
          </div>

          {isPaid && (
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                className="h-11 rounded-xl border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => navigate(`/dashboard/appointments/${appt.id}/recibo`)}
              >
                <Receipt className="w-4 h-4 mr-2" /> Baixar recibo
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-xl"
                onClick={async () => {
                  const t = toast.loading("Enviando recibo por e-mail...");
                  const { error } = await db.functions.invoke("appointment-confirmed", {
                    body: { appointment_id: appt.id },
                  });
                  toast.dismiss(t);
                  if (error) toast.error("Não foi possível enviar o recibo");
                  else toast.success("Recibo enviado para o seu e-mail!");
                }}
              >
                <Receipt className="w-4 h-4 mr-2" /> Enviar por e-mail
              </Button>
            </div>
          )}

          {canReschedule ? (
            <>
            <div className="grid grid-cols-2 gap-2.5">
              <CancelRescheduleDialog
                appointmentId={appt.id}
                doctorId={appt.doctor_id}
                currentDate={format(date, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                scheduledAt={appt.scheduled_at}
                doctorName={appt.doctor_name}
                defaultMode="reschedule"
                onSuccess={() => navigate("/dashboard/appointments")}
                trigger={
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl border-secondary/40 text-secondary hover:bg-secondary/5"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Remarcar
                  </Button>
                }
              />
              <CancelRescheduleDialog
                appointmentId={appt.id}
                doctorId={appt.doctor_id}
                currentDate={format(date, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                scheduledAt={appt.scheduled_at}
                doctorName={appt.doctor_name}
                defaultMode="cancel"
                onSuccess={() => navigate("/dashboard/appointments")}
                trigger={
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/5"
                  >
                    <X className="w-4 h-4 mr-2" /> Cancelar
                  </Button>
                }
              />
            </div>
            {isPaid && (
              <div className={`mt-2 rounded-xl border p-3 text-[11px] leading-relaxed ${
                refundTier === "full"
                  ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                  : "border-amber-200 dark:border-amber-900/60 bg-amber-500/5 text-amber-800 dark:text-amber-300"
              }`}>
                <div className="flex items-start gap-2">
                  {refundTier === "full" ? (
                    <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {refundTier === "full"
                        ? "Reembolso integral disponível"
                        : "Janela de reembolso parcial"}
                    </p>
                    <p className="opacity-90">
                      {refundTier === "full"
                        ? "Cancelando agora você recebe 100% do valor de volta. Remarcação é gratuita."
                        : "Faltam menos de 24h — cancelamentos têm reembolso de 50% e remarcações podem ter taxa de reagendamento."}
                    </p>
                  </div>
                </div>
              </div>
            )}
            </>
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Prazo encerrado</p>
                  <p>
                    Cancelamentos e remarcações online só podem ser feitos até 2h antes do horário marcado.
                    {isPaid && " Cancelamentos neste prazo não são reembolsáveis."}
                    {" "}Para urgências, entre em contato com o suporte.
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Preparation checklist */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6"
        >
          <Card className="border-border/60">
            <CardContent className="p-5">
              <p className="text-[11px] uppercase tracking-wider font-bold text-primary mb-3">
                Como se preparar
              </p>
              <ul className="space-y-2.5 text-sm text-foreground">
                <li className="flex items-start gap-2.5">
                  <Wifi className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  Conexão estável de internet (Wi-Fi ou 4G).
                </li>
                <li className="flex items-start gap-2.5">
                  <Camera className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  Câmera e microfone funcionando — testaremos antes de entrar.
                </li>
                <li className="flex items-start gap-2.5">
                  <Mic className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  Ambiente silencioso e privado para a conversa.
                </li>
                <li className="flex items-start gap-2.5">
                  <FileText className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  Tenha em mãos exames recentes, receitas e lista de medicamentos.
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* Trust strip */}
        <p className="text-center text-[11px] text-muted-foreground mt-8">
          Você receberá uma confirmação por WhatsApp e e-mail. Em caso de imprevisto, é possível remarcar gratuitamente até 2h antes.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default AppointmentConfirmed;