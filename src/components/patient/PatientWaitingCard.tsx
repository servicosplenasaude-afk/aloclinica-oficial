import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Video, Users, Lightbulb } from "lucide-react";
import { db } from "@/integrations/supabase/untyped";
import { useNavigate } from "react-router-dom";
import mascotWave from "@/assets/states/pingo-espera-paciente.webp";
import WaitingAnamnesis from "./WaitingAnamnesis";

interface Props {
  appointment: {
    id: string;
    doctor_id: string;
    doctor_name: string;
    status: string;
    patient_id?: string;
  };
}

const PatientWaitingCard = ({ appointment }: Props) => {
  const navigate = useNavigate();
  const [position, setPosition] = useState<number | null>(null);
  const [healthTip, setHealthTip] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [avgConsultDuration, setAvgConsultDuration] = useState(20);

  useEffect(() => {
    // Fetch queue position with estimated wait based on real consultation durations
    const fetchPosition = async () => {
      const [queueRes, durationRes] = await Promise.all([
        db
          .from("appointments")
          .select("id, scheduled_at, duration_minutes")
          .eq("doctor_id", appointment.doctor_id)
          .eq("status", "waiting")
          .order("scheduled_at", { ascending: true }),
        // Get average actual consultation duration from recent completed appointments
        db
          .from("video_presence_logs")
          .select("duration_seconds")
          .gt("duration_seconds", 0)
          .order("joined_at", { ascending: false })
          .limit(20),
      ]);

      if (queueRes.data) {
        const idx = queueRes.data.findIndex(a => a.id === appointment.id);
        setPosition(idx >= 0 ? idx + 1 : null);

        // Calculate dynamic wait time
        const durations = (durationRes.data ?? []).map(d => d.duration_seconds ?? 0).filter(d => d > 60);
        const avgDurationMin = durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60)
          : 20; // fallback 20min
        setAvgConsultDuration(avgDurationMin);
      }
    };

    // Fetch random health tip
    const fetchTip = async () => {
      const { data } = await db
        .from("health_tips")
        .select("content")
        .eq("is_active", true)
        .limit(10);
      if (data && data.length > 0) {
        setHealthTip(data[Math.floor(Math.random() * data.length)].content);
      }
    };

    fetchPosition();
    fetchTip();

    // Subscribe to real-time updates
    const channel = db
      .channel(`waiting-room-${appointment.doctor_id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "appointments",
        filter: `doctor_id=eq.${appointment.doctor_id}`,
      }, () => fetchPosition())
      .subscribe();

    // Elapsed timer
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);

    return () => {
      db.removeChannel(channel);
      clearInterval(timer);
    };
  }, [appointment.doctor_id, appointment.id]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const estimatedWait = position ? (position - 1) * avgConsultDuration : 0;
  const isReady = appointment.status === "in_progress";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={`overflow-hidden border-2 ${
        isReady ? "border-success/40 bg-success/5" : "border-primary/30 bg-primary/5"
      }`}>
        <CardContent className="p-4">
          {isReady ? (
            /* Ready to enter */
            <div className="text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-success/20 flex items-center justify-center animate-pulse">
                <Video className="w-7 h-7 text-success" />
              </div>
              <div>
                <p className="text-sm font-bold text-success">O médico está pronto!</p>
                <p className="text-xs text-muted-foreground">{appointment.doctor_name} iniciou a consulta</p>
              </div>
              <Button
                className="w-full bg-success text-success-foreground rounded-xl h-10"
                onClick={() => navigate(`/dashboard/consultation/${appointment.id}`)}
              >
                <Video className="w-4 h-4 mr-2" /> Entrar na consulta
              </Button>
            </div>
          ) : (
            /* Waiting */
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img src={mascotWave} alt="Pingo" className="w-12 h-12 object-contain" loading="lazy" decoding="async" width={48} height={48} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">Sala de Espera</p>
                  <p className="text-xs text-muted-foreground">{appointment.doctor_name}</p>
                </div>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary animate-pulse">
                  <Clock className="w-3 h-3 mr-1" /> {formatElapsed(elapsed)}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-center">
                {position !== null && (
                  <div className="flex-1 p-2.5 rounded-xl bg-card border border-border/40">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Users className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-lg font-bold text-foreground">{position}º</p>
                    <p className="text-[10px] text-muted-foreground">na fila</p>
                  </div>
                )}
                <div className="flex-1 p-2.5 rounded-xl bg-card border border-border/40">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-3.5 h-3.5 text-warning" />
                  </div>
                  <p className="text-lg font-bold text-foreground">~{estimatedWait}min</p>
                  <p className="text-[10px] text-muted-foreground">estimado</p>
                </div>
              </div>

              {healthTip && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/30">
                  <Lightbulb className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{healthTip}</p>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => navigate(`/dashboard/consultation/${appointment.id}`)}
              >
                Entrar na sala de espera
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anamnese assistida pela IA enquanto o paciente espera o médico entrar */}
      <div className="mt-3">
        <WaitingAnamnesis appointmentId={appointment.id} patientId={(appointment as any).patient_id ?? ""} />
      </div>
    </motion.div>
  );
};

export default PatientWaitingCard;
