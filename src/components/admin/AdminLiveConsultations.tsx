import { useState, useEffect } from "react";
import mascotThumbsup from "@/assets/states/pingo-consultas-ao-vivo.webp";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getAdminNav } from "./adminNav";
import { AdminPageHeader } from "./AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/integrations/supabase/untyped";
import { Video, Clock, AlertTriangle, RefreshCw, Users, CheckCircle2 } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LiveAppt {
  id: string;
  scheduled_at: string;
  status: string;
  doctor_id: string;
  patient_id: string | null;
  doctor_name: string;
  patient_name: string;
  delay_minutes: number;
}

const AdminLiveConsultations = () => {
  const [appointments, setAppointments] = useState<LiveAppt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLive = async () => {
    setLoading(true);
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const { data } = await db
      .from("appointments")
      .select("id, scheduled_at, status, doctor_id, patient_id")
      .in("status", ["scheduled", "waiting", "in_progress"])
      .gte("scheduled_at", twoHoursAgo.toISOString())
      .order("scheduled_at", { ascending: true });

    if (!data || data.length === 0) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    // Get doctor & patient names
    const doctorIds = [...new Set(data.map(a => a.doctor_id))];
    const patientIds = [...new Set(data.map(a => a.patient_id).filter(Boolean))];

    const { data: docs } = await db.from("doctor_profiles").select("id, user_id").in("id", doctorIds);
    const allUserIds = [
      ...(docs?.map(d => d.user_id) ?? []),
      ...(patientIds.filter((id): id is string => id !== null)),
    ];
    const { data: profiles } = await db.from("profiles").select("user_id, first_name, last_name").in("user_id", allUserIds);

    const getName = (userId: string) => {
      const p = profiles?.find(pr => pr.user_id === userId);
      return p ? `${p.first_name} ${p.last_name}` : "—";
    };

    const mapped: LiveAppt[] = data.map(a => {
      const doc = docs?.find(d => d.id === a.doctor_id);
      const scheduledTime = new Date(a.scheduled_at);
      const delay = a.status === "scheduled" && scheduledTime < now
        ? differenceInMinutes(now, scheduledTime)
        : 0;

      return {
        ...a,
        doctor_name: doc ? `Dr(a). ${getName(doc.user_id)}` : "—",
        patient_name: a.patient_id ? getName(a.patient_id) : "Convidado",
        delay_minutes: delay,
      };
    });

    setAppointments(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
    scheduled: { label: "Aguardando", color: "bg-warning/10 text-warning border-warning/30", icon: Clock },
    waiting: { label: "Na Espera", color: "bg-primary/10 text-primary border-primary/30", icon: Users },
    in_progress: { label: "Em Andamento", color: "bg-success/10 text-success border-success/30", icon: Video },
  };

  const delayed = appointments.filter(a => a.delay_minutes > 5);
  const inProgress = appointments.filter(a => a.status === "in_progress");

  return (
    <DashboardLayout title="Admin" nav={getAdminNav("live")}>
      <div className="w-full mx-auto max-w-4xl space-y-5 pb-24 md:pb-6">
        <AdminPageHeader
          icon={Video}
          eyebrow="Visão Geral"
          title="Consultas ao Vivo"
          description="Monitoramento em tempo real de consultas ativas e atrasos."
          accent="from-rose-500 to-pink-600"
          badge={
            inProgress.length > 0
              ? { label: `${inProgress.length} ao vivo`, tone: "danger" }
              : { label: "Sem consultas agora", tone: "default" }
          }
          actions={
            <Button variant="outline" size="sm" onClick={fetchLive} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{inProgress.length}</p>
                <p className="text-xs text-muted-foreground">Em andamento</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{appointments.length}</p>
                <p className="text-xs text-muted-foreground">Total ativas</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-border/50 ${delayed.length > 0 ? "border-destructive/30" : ""}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${delayed.length > 0 ? "bg-destructive/10" : "bg-success/10"}`}>
                {delayed.length > 0
                  ? <AlertTriangle className="w-5 h-5 text-destructive" />
                  : <CheckCircle2 className="w-5 h-5 text-success" />}
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{delayed.length}</p>
                <p className="text-xs text-muted-foreground">Com atraso</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Delayed alerts */}
        {delayed.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Consultas com Atraso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {delayed.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-background/60 border border-destructive/20">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{a.doctor_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Paciente: {a.patient_name} · Agendada para {format(new Date(a.scheduled_at), "HH:mm")}
                    </p>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    ⏰ {a.delay_minutes} min de atraso
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* All appointments */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Todas as Consultas Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="flex flex-col items-center py-10">
                <img src={mascotThumbsup} alt="Pingo" className="w-24 h-24 object-contain select-none mb-3" style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,.15))" }} loading="lazy" decoding="async" width={96} height={96} />
                <p className="text-[13px] font-bold text-foreground">Nenhuma consulta ativa</p>
                <p className="text-[11px] text-muted-foreground mt-1">As consultas em andamento aparecerão aqui</p>
              </div>
            ) : (
              <div className="space-y-2">
                {appointments.map(a => {
                  const cfg = statusConfig[a.status] || statusConfig.scheduled;
                  const Icon = cfg.icon;
                  return (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.color.split(" ")[0]}`}>
                          <Icon className={`w-4 h-4 ${cfg.color.split(" ")[1]}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{a.doctor_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {a.patient_name} · {format(new Date(a.scheduled_at), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.delay_minutes > 5 && (
                          <Badge variant="destructive" className="text-[10px]">{a.delay_minutes}min</Badge>
                        )}
                        <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminLiveConsultations;
