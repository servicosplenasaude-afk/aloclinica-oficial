import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Stethoscope, Timer, Sparkles, UserCheck, UserX, Bell } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { notify } from "@/lib/notifications";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { getClinicNav } from "./clinicNav";

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } } };

const ClinicWaitingRoom = () => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [waiting, setWaiting] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<Map<string, string>>(new Map());
  const [patients, setPatients] = useState<Map<string, string>>(new Map());
  const [doctorIds, setDoctorIds] = useState<string[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();

  useEffect(() => { if (user) fetchData(); }, [user]);

  // Real-time updates
  useEffect(() => {
    const channel = db
      .channel("clinic-waiting-room")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        if (user) fetchData();
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const { data: clinic } = await db.from("clinic_profiles").select("id").eq("user_id", user!.id).single();
    if (!clinic) { setLoading(false); return; }

    const { data: affiliations } = await db.from("clinic_affiliations").select("doctor_id").eq("clinic_id", clinic.id).eq("status", "active");
    const doctorIds = (affiliations ?? []).map(a => a.doctor_id);
    setDoctorIds(doctorIds);
    if (doctorIds.length === 0) { setLoading(false); setWaiting([]); return; }

    // Fetch doctor names
    const { data: docProfiles } = await db.from("doctor_profiles").select("id, user_id").in("id", doctorIds);
    const userIds = (docProfiles ?? []).map(d => d.user_id);
    const { data: profiles } = userIds.length > 0
      ? await db.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds)
      : { data: [] };
    const docMap = new Map<string, string>();
    (docProfiles ?? []).forEach(dp => {
      const p = (profiles ?? []).find(pr => pr.user_id === dp.user_id);
      if (p) docMap.set(dp.id, `Dr(a). ${p.first_name}`);
    });
    setDoctors(docMap);

    // Today's upcoming/confirmed appointments (waiting room)
    const todayStr = format(now, "yyyy-MM-dd");
    const { data: appts } = await db.from("appointments")
      .select("*")
      .in("doctor_id", doctorIds)
      .gte("scheduled_at", `${todayStr}T00:00:00`)
      .lte("scheduled_at", `${todayStr}T23:59:59`)
      .in("status", ["scheduled", "confirmed", "waiting"])
      .order("scheduled_at", { ascending: true });

    setWaiting(appts ?? []);

    // Patient names
    const patientIds = [...new Set((appts ?? []).map(a => a.patient_id).filter(Boolean))];
    if (patientIds.length > 0) {
      const { data: patProfiles } = await db.from("profiles").select("user_id, first_name, last_name").in("user_id", patientIds.filter((id): id is string => id !== null));
      const patMap = new Map<string, string>();
      (patProfiles ?? []).forEach(p => patMap.set(p.user_id, `${p.first_name} ${p.last_name}`));
      setPatients(patMap);
    }

    setLoading(false);
  };

  const getWaitTime = (scheduledAt: string) => {
    const diff = differenceInMinutes(new Date(scheduledAt), now);
    if (diff <= 0) return { label: "Atrasado", urgent: true };
    if (diff <= 15) return { label: `${diff}min`, urgent: false };
    return { label: `${diff}min`, urgent: false };
  };

  // Registra chegada do paciente (check-in). O guard `.in("doctor_id", doctorIds)`
  // garante que a clínica só age em consultas dos seus médicos vinculados.
  const checkIn = async (appt: any) => {
    setActing(appt.id);
    const { error } = await db.from("appointments").update({ status: "waiting" }).eq("id", appt.id).in("doctor_id", doctorIds);
    setActing(null);
    if (error) { toast.error("Não foi possível registrar a chegada."); return; }
    setWaiting(prev => prev.map(w => (w.id === appt.id ? { ...w, status: "waiting" } : w)));
    toast.success(`Chegada registrada — ${patients.get(appt.patient_id) ?? "paciente"}`);
    fetchData();
  };

  const markNoShow = async (appt: any) => {
    const ok = await confirm({
      title: "Marcar falta?",
      description: `${patients.get(appt.patient_id) ?? "O paciente"} será marcado como ausente (no-show) e sairá da sala de espera.`,
      confirmLabel: "Marcar falta",
      destructive: true,
    });
    if (!ok) return;
    setActing(appt.id);
    const { error } = await db.from("appointments").update({ status: "no_show" }).eq("id", appt.id).in("doctor_id", doctorIds);
    setActing(null);
    if (error) { toast.error("Não foi possível marcar a falta."); return; }
    setWaiting(prev => prev.filter(w => w.id !== appt.id));
    toast.success(`Falta registrada — ${patients.get(appt.patient_id) ?? "paciente"}`);
    fetchData();
  };

  const notifyPatient = async (appt: any) => {
    if (!appt.patient_id) { toast.error("Paciente sem cadastro para avisar."); return; }
    setActing(appt.id);
    try {
      const doctorName = doctors.get(appt.doctor_id) ?? "O médico";
      await notify(
        appt.patient_id,
        "🔔 A clínica está pronta para você",
        `${doctorName} já está pronto(a) para o seu atendimento. Dirija-se à recepção.`,
        "appointment",
        { link: "/dashboard/appointments?role=patient" },
      );
      toast.success(`Paciente avisado — ${patients.get(appt.patient_id) ?? ""}`.trim());
    } catch {
      toast.error("Não foi possível avisar o paciente.");
    } finally {
      setActing(null);
    }
  };

  return (
    <DashboardLayout title="Sala de Espera" nav={getClinicNav("waiting-room")} role="clinic">
      <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} className="max-w-4xl space-y-5">
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Sala de Espera</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{waiting.length} paciente{waiting.length !== 1 ? "s" : ""} aguardando hoje</p>
          </div>
          <Badge variant="outline" className="text-xs border-success/30 bg-success/5 text-success px-3 py-1.5 rounded-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse mr-1.5 inline-block" />
            Tempo real
          </Badge>
        </motion.div>

        {/* KPIs */}
        <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Aguardando", value: waiting.length, color: "text-primary", bg: "bg-primary/10", icon: Clock },
            { label: "Atrasados", value: waiting.filter(w => differenceInMinutes(new Date(w.scheduled_at), now) < 0).length, color: "text-destructive", bg: "bg-destructive/10", icon: Timer },
            { label: "Médicos ativos", value: new Set(waiting.map(w => w.doctor_id)).size, color: "text-secondary", bg: "bg-secondary/10", icon: Stethoscope },
          ].map(kpi => (
            <div key={kpi.label} className="p-4 rounded-2xl bg-card border border-border/50 text-center">
              <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center mx-auto mb-2`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Waiting list */}
        <motion.div variants={fadeUp}>
          <Card className="border-border/50">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3 pb-24 md:pb-8">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              ) : waiting.length === 0 ? (
                <div className="text-center py-14">
                  <Sparkles className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum paciente na espera</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Os pacientes aparecerão aqui quando tiverem consultas agendadas para hoje</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {waiting.map((appt, idx) => {
                    const wait = getWaitTime(appt.scheduled_at);
                    return (
                      <div key={appt.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {patients.get(appt.patient_id) ?? "Paciente"}
                          </p>
                          <p className="text-xs text-muted-foreground">{doctors.get(appt.doctor_id) ?? "Médico"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono font-semibold text-foreground">{format(new Date(appt.scheduled_at), "HH:mm")}</p>
                          {appt.status === "waiting" ? (
                            <Badge variant="outline" className="text-[10px] mt-0.5 border-success/30 text-success bg-success/5">
                              <UserCheck className="w-2.5 h-2.5 mr-0.5" />Chegou
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={`text-[10px] mt-0.5 ${wait.urgent ? "border-destructive/30 text-destructive bg-destructive/5" : "border-border text-muted-foreground"}`}>
                              {wait.urgent && <Timer className="w-2.5 h-2.5 mr-0.5" />}
                              {wait.label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {appt.status !== "waiting" && (
                            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs px-2" disabled={acting === appt.id} onClick={() => checkIn(appt)} title="Marcar chegada / check-in" aria-label="Marcar chegada / check-in">
                              <UserCheck className="w-3.5 h-3.5 sm:mr-1 text-success" /><span className="hidden sm:inline">Chegada</span>
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs px-2" disabled={acting === appt.id} onClick={() => notifyPatient(appt)} title="Avisar paciente" aria-label="Avisar paciente">
                            <Bell className="w-3.5 h-3.5 sm:mr-1 text-primary" /><span className="hidden sm:inline">Avisar</span>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs px-2" disabled={acting === appt.id} onClick={() => markNoShow(appt)} title="Marcar falta" aria-label="Marcar falta">
                            <UserX className="w-3.5 h-3.5 sm:mr-1 text-destructive" /><span className="hidden sm:inline">Falta</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
};

export default ClinicWaitingRoom;
