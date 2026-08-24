import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera, Mic, MicOff, CameraOff, CheckCircle2, AlertTriangle,
  Loader2, Users, Volume2, MessageCircle, Clock, Send, RefreshCw,
  PhoneCall, ChevronDown, Wifi, Shield, Speaker
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import mascotImg from "@/assets/states/pingo-pre-chamada.webp";
import { format, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import PreConsultationForm from "@/components/patient/PreConsultationForm";
import { useIsMobile } from "@/hooks/use-mobile";

interface PreCallCheckProps {
  appointmentId?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  scheduledAt?: string;
  onReady: () => void;
  isDoctor?: boolean;
}

interface WaitingMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
}

const PreCallCheck = ({ appointmentId, doctorName, doctorSpecialty, scheduledAt, onReady, isDoctor = false }: PreCallCheckProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const [micOk, setMicOk] = useState<boolean | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [testing, setTesting] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [volume, setVolume] = useState(0);
  const [doctorPresent, setDoctorPresent] = useState(false);
  const [pollingStatus, setPollingStatus] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [waitingPosition, setWaitingPosition] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<WaitingMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof db.channel> | null>(null);
  const [symptomsSubmitted, setSymptomsSubmitted] = useState(false);
  const [showSymptomForm, setShowSymptomForm] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<"good" | "fair" | "poor" | null>(null);
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [deviceError, setDeviceError] = useState<{
    kind: "permission" | "in-use" | "not-found" | "insecure" | "unknown";
    message: string;
  } | null>(null);
  const [speakerTesting, setSpeakerTesting] = useState(false);
  const speakerAudioRef = useRef<HTMLAudioElement | null>(null);

  // Check if symptoms already submitted
  useEffect(() => {
    if (!appointmentId || isDoctor) return;
    db.from("pre_consultation_symptoms")
      .select("id")
      .eq("appointment_id", appointmentId)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setSymptomsSubmitted(true);
        else setShowSymptomForm(true);
      });
  }, [appointmentId, isDoctor]);

  // Countdown timer
  useEffect(() => {
    if (!scheduledAt) return;
    const update = () => {
      const diff = differenceInSeconds(new Date(scheduledAt), new Date());
      setCountdown(Math.max(0, diff));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [scheduledAt]);

  // Device testing + network quality
  useEffect(() => {
    testDevices();
    testNetwork();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const testNetwork = async () => {
    try {
      const start = performance.now();
      await fetch(`${window.location.origin}/favicon.ico?_t=${Date.now()}`, { cache: "no-store" });
      const latency = Math.round(performance.now() - start);
      setNetworkLatency(latency);
      setNetworkQuality(latency < 150 ? "good" : latency < 400 ? "fair" : "poor");
    } catch {
      setNetworkQuality("poor");
      setNetworkLatency(null);
    }
  };

  // Poll appointment status for doctor presence — realtime + polling fallback
  useEffect(() => {
    if (!appointmentId || isDoctor) return;
    setPollingStatus(true);
    let pollActive = true;
    let statusPollInterval = 5000;
    let statusPollTimeout: ReturnType<typeof setTimeout>;

    const channel = db
      .channel(`precall-${appointmentId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments", filter: `id=eq.${appointmentId}` },
        (payload) => {
          if (payload.new.status === "medico_presente" || payload.new.status === "in_progress") {
            setDoctorPresent(true);
          }
          statusPollInterval = 5000; // reset on realtime event
          // Check position on any appointment update
          updateWaitingPosition();
        }
      )
      .subscribe();

    const checkNow = async () => {
      const { data } = await db.from("appointments").select("status").eq("id", appointmentId).single();
      if (data && (data.status === "medico_presente" || data.status === "in_progress")) {
        setDoctorPresent(true);
        return true;
      }
      return false;
    };
    checkNow();

    // Fallback polling for doctor presence
    const pollStatus = async () => {
      const found = await checkNow();
      if (found) return; // stop polling once doctor is present
      statusPollInterval = Math.min(statusPollInterval * 1.2, 20000);
      if (pollActive) statusPollTimeout = setTimeout(pollStatus, statusPollInterval);
    };
    statusPollTimeout = setTimeout(pollStatus, statusPollInterval);

    const updateWaitingPosition = async () => {
      const { data } = await db
        .from("appointments")
        .select("id")
        .in("status", ["waiting", "scheduled"])
        .lt("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true });
      if (data) {
        const idx = data.findIndex(a => a.id === appointmentId);
        setWaitingPosition(idx >= 0 ? idx + 1 : null);
      }
    };
    updateWaitingPosition();

    return () => {
      pollActive = false;
      clearTimeout(statusPollTimeout);
      db.removeChannel(channel);
    };
  }, [appointmentId, isDoctor]);

  // Increment waiting seconds counter for progressive messages
  useEffect(() => {
    if (doctorPresent || isDoctor) return;
    const interval = setInterval(() => {
      setWaitingSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [doctorPresent, isDoctor]);

  // Waiting room chat
  useEffect(() => {
    if (!appointmentId || !user) return;
    const roomChannel = db.channel(`waiting-chat-${appointmentId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = roomChannel;
    roomChannel
      .on("broadcast", { event: "waiting-msg" }, ({ payload }) => {
        setChatMessages(prev => [...prev, payload as WaitingMessage]);
      })
      .subscribe();
    return () => { db.removeChannel(roomChannel); };
  }, [appointmentId, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const classifyError = (err: unknown): { kind: "permission" | "in-use" | "not-found" | "insecure" | "unknown"; message: string } => {
    const e = err as { name?: string; message?: string };
    const name = e?.name || "";
    if (!window.isSecureContext) {
      return { kind: "insecure", message: "Esta página precisa estar em HTTPS para usar câmera/microfone." };
    }
    if (name === "NotAllowedError" || name === "SecurityError") {
      return { kind: "permission", message: "Permissão negada. Clique no cadeado da barra de endereço e habilite câmera/microfone." };
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return { kind: "not-found", message: "Nenhum dispositivo encontrado. Conecte uma câmera/microfone e tente novamente." };
    }
    if (name === "NotReadableError" || name === "AbortError") {
      return { kind: "in-use", message: "Dispositivo em uso por outro aplicativo. Feche apps de vídeo (Zoom, Meet) e tente novamente." };
    }
    return { kind: "unknown", message: e?.message || "Falha ao acessar dispositivos." };
  };

  const attachAudioAnalyser = (audioTrack: MediaStreamTrack) => {
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = audioCtx.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((sum, v) => sum + v, 0) / dataArr.length;
        setVolume(Math.min(avg / 80, 1));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch {
      /* analyser is non-critical */
    }
  };

  const testDevices = async () => {
    setTesting(true);
    setDeviceError(null);
    // stop any previous stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraOk(false);
      setMicOk(false);
      setDeviceError({ kind: "insecure", message: "Seu navegador não suporta acesso a câmera/microfone." });
      setTesting(false);
      return;
    }

    let combined: MediaStream | null = null;
    let firstError: unknown = null;
    try {
      combined = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      firstError = err;
    }

    // Fallback: try independently if combined failed
    if (!combined) {
      const tracks: MediaStreamTrack[] = [];
      let camErr: unknown = null;
      let micErr: unknown = null;
      try {
        const v = await navigator.mediaDevices.getUserMedia({ video: true });
        v.getTracks().forEach(t => tracks.push(t));
      } catch (err) { camErr = err; }
      try {
        const a = await navigator.mediaDevices.getUserMedia({ audio: true });
        a.getTracks().forEach(t => tracks.push(t));
      } catch (err) { micErr = err; }

      if (tracks.length > 0) {
        combined = new MediaStream(tracks);
      }
      setCameraOk(camErr ? false : tracks.some(t => t.kind === "video"));
      setMicOk(micErr ? false : tracks.some(t => t.kind === "audio"));
      const errToShow = camErr ?? micErr ?? firstError;
      if (errToShow) setDeviceError(classifyError(errToShow));
    } else {
      const videoTrack = combined.getVideoTracks()[0];
      const audioTrack = combined.getAudioTracks()[0];
      setCameraOk(!!videoTrack && videoTrack.readyState === "live");
      setMicOk(!!audioTrack && audioTrack.readyState === "live");
    }

    if (combined) {
      setStream(combined);
      streamRef.current = combined;
      if (videoRef.current) videoRef.current.srcObject = combined;
      const audioTrack = combined.getAudioTracks()[0];
      if (audioTrack) attachAudioAnalyser(audioTrack);
    }

    setTesting(false);
  };

  const testSpeaker = () => {
    if (speakerTesting) return;
    setSpeakerTesting(true);
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.25);
      setTimeout(() => { setSpeakerTesting(false); ctx.close().catch(() => {}); }, 1400);
    } catch {
      setSpeakerTesting(false);
    }
  };

  const toggleCamera = useCallback(() => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    }
  }, [stream]);

  const toggleMic = useCallback(() => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  }, [stream]);

  const handleEnter = useCallback(async () => {
    if (appointmentId && !isDoctor) {
      await db.from("appointments").update({ status: "waiting" }).eq("id", appointmentId);
    }
    stream?.getTracks().forEach(t => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    onReady();
  }, [stream, onReady, appointmentId, isDoctor]);

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    const msg: WaitingMessage = {
      id: Date.now().toString(),
      sender: isDoctor ? "doctor" : "patient",
      text: chatInput.trim(),
      time: format(new Date(), "HH:mm"),
    };
    setChatMessages(prev => [...prev, msg]);
    channelRef.current?.send({ type: "broadcast", event: "waiting-msg", payload: msg });
    setChatInput("");
  };

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
    if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
    return `${s}s`;
  };

  const allGood = cameraOk === true && micOk === true;
  const userName = user?.user_metadata?.first_name || (isDoctor ? "Médico" : "Paciente");

  /* ─── Status pill helper ─── */
  const StatusPill = ({ ok, label }: { ok: boolean | null; label: string }) => (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
      ok ? 'bg-[hsl(150,60%,40%,0.12)] text-[hsl(150,60%,55%)] border border-[hsl(150,60%,40%,0.2)]'
         : ok === false ? 'bg-destructive/10 text-destructive border border-destructive/20'
         : 'bg-[hsl(220,20%,15%)] text-[hsl(220,15%,55%)] border border-[hsl(220,15%,22%)]'
    }`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : ok === false ? <AlertTriangle className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {label} {ok ? 'OK' : ok === false ? 'Erro' : '...'}
    </div>
  );

  /* ─── MOBILE LAYOUT ─── */
  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-[hsl(220,20%,6%)] flex flex-col" style={{ height: '100dvh' }}>
        {/* Compact top bar */}
        <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top,8px),8px)] pb-2 bg-[hsl(220,20%,8%)] border-b border-[hsl(220,15%,15%)]">
          <div className="flex items-center gap-2 min-w-0">
            <img src={mascotImg} alt="Mascot" className="w-7 h-7 shrink-0" loading="lazy" decoding="async" width={28} height={28} />
            <h1 className="text-sm font-bold text-white truncate">
              {isDoctor ? "Preparar" : "Pré-consulta"}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Network quality badge */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${
              networkQuality === "good" ? "bg-[hsl(150,60%,40%,0.15)] border-[hsl(150,60%,40%,0.25)]"
              : networkQuality === "fair" ? "bg-warning/15 border-warning/25"
              : networkQuality === "poor" ? "bg-destructive/15 border-destructive/25"
              : "bg-[hsl(220,20%,15%)] border-[hsl(220,15%,25%)]"
            }`}>
              <Wifi className={`w-2.5 h-2.5 ${
                networkQuality === "good" ? "text-[hsl(150,60%,45%)]"
                : networkQuality === "fair" ? "text-warning"
                : networkQuality === "poor" ? "text-destructive"
                : "text-[hsl(220,15%,55%)]"
              }`} />
              <span className={`text-[10px] font-medium ${
                networkQuality === "good" ? "text-[hsl(150,60%,55%)]"
                : networkQuality === "fair" ? "text-warning"
                : networkQuality === "poor" ? "text-destructive"
                : "text-[hsl(220,15%,55%)]"
              }`}>
                {networkQuality === "good" ? "Boa" : networkQuality === "fair" ? "Média" : networkQuality === "poor" ? "Fraca" : "..."}
                {networkLatency && <span className="ml-0.5 opacity-70">{networkLatency}ms</span>}
              </span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(220,20%,15%)] border border-[hsl(220,15%,25%)]">
              <Shield className="w-2.5 h-2.5 text-[hsl(220,15%,55%)]" />
            </div>
          </div>
        </div>

        {/* Vertical video preview — takes available space */}
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${!cameraOn ? 'hidden' : ''}`}
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Camera off / error state */}
          {(!cameraOn || (!cameraOk && !testing)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-[hsl(220,20%,10%)]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full bg-[hsl(220,20%,20%)] flex items-center justify-center">
                  <span className="text-3xl font-bold text-[hsl(220,15%,55%)]">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-[hsl(220,15%,55%)]">
                  {!cameraOk && !testing ? "Câmera não detectada" : "Câmera desligada"}
                </p>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {testing && (
            <div className="absolute inset-0 flex items-center justify-center bg-[hsl(220,20%,8%,0.7)] backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm text-[hsl(220,15%,65%)]">Verificando dispositivos...</p>
              </div>
            </div>
          )}

          {/* User name + volume badge */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(220,20%,8%,0.75)] backdrop-blur-md border border-[hsl(220,15%,20%)]">
              <span className="text-sm font-medium text-white">{userName}</span>
            </div>
            {micOn && micOk && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[hsl(220,20%,8%,0.75)] backdrop-blur-md border border-[hsl(220,15%,20%)]">
                <Volume2 className="w-3.5 h-3.5 text-[hsl(150,60%,50%)]" />
                <div className="flex gap-0.5 items-end h-3">
                  {[0.2, 0.4, 0.6, 0.8, 1].map((threshold, i) => (
                    <motion.div
                      key={i}
                      className={`w-1 rounded-full ${volume >= threshold ? 'bg-[hsl(150,60%,50%)]' : 'bg-[hsl(220,15%,30%)]'}`}
                      animate={{ height: volume >= threshold ? `${60 + i * 10}%` : '30%' }}
                      transition={{ duration: 0.1 }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Doctor info overlay (top of video) */}
          {!isDoctor && (doctorName || scheduledAt) && (
            <div className="absolute top-3 left-3 right-3">
              <div className="rounded-xl bg-[hsl(220,20%,8%,0.85)] backdrop-blur-md border border-[hsl(220,15%,20%)] px-3 py-2.5 flex items-center gap-3">
                {doctorName && (
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{doctorName.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {doctorName && <p className="text-xs font-semibold text-white truncate">{doctorName}</p>}
                  {doctorSpecialty && <p className="text-[10px] text-[hsl(220,15%,50%)]">{doctorSpecialty}</p>}
                </div>
                {scheduledAt && countdown !== null && (
                  <div className="shrink-0">
                    {countdown > 0 ? (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" />
                        <span className="text-[11px] font-mono font-bold text-primary">{formatCountdown(countdown)}</span>
                      </div>
                    ) : (
                      <Badge className="bg-[hsl(150,60%,40%,0.15)] text-[hsl(150,60%,55%)] border-[hsl(150,60%,40%,0.25)] text-[9px]">
                        Agora!
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom panel: controls + status + CTA */}
        <div className="bg-[hsl(220,20%,8%)] border-t border-[hsl(220,15%,15%)] px-4 pb-[max(env(safe-area-inset-bottom,8px),8px)]">
          {/* Device status + controls row */}
          <div className="flex items-center justify-center gap-4 py-3">
            <button
              onClick={toggleMic}
              disabled={!micOk}
              aria-label={micOn ? "Desligar microfone" : "Ligar microfone"}
              className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                micOn && micOk
                  ? 'bg-[hsl(220,20%,18%)] hover:bg-[hsl(220,20%,23%)] text-white'
                  : 'bg-destructive/90 text-destructive-foreground'
              }`}
            >
              {micOn && micOk ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              {micOk === false && (
                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5 text-destructive-foreground" />
                </div>
              )}
            </button>

            <button
              onClick={toggleCamera}
              disabled={!cameraOk}
              aria-label={cameraOn ? "Desligar câmera" : "Ligar câmera"}
              className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                cameraOn && cameraOk
                  ? 'bg-[hsl(220,20%,18%)] hover:bg-[hsl(220,20%,23%)] text-white'
                  : 'bg-destructive/90 text-destructive-foreground'
              }`}
            >
              {cameraOn && cameraOk ? <Camera className="w-6 h-6" /> : <CameraOff className="w-6 h-6" />}
              {cameraOk === false && (
                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5 text-destructive-foreground" />
                </div>
              )}
            </button>

            <button
              onClick={testDevices}
              disabled={testing}
              aria-label="Testar dispositivos"
              className="w-11 h-11 rounded-full flex items-center justify-center bg-[hsl(220,20%,18%)] hover:bg-[hsl(220,20%,23%)] text-[hsl(220,15%,60%)] transition-all"
            >
              <RefreshCw className={`w-5 h-5 ${testing ? 'animate-spin' : ''}`} />
            </button>

            {/* Chat toggle */}
            {!isDoctor && appointmentId && (
              <button
                onClick={() => setShowChat(!showChat)}
                aria-label="Abrir chat"
                className="relative w-11 h-11 rounded-full flex items-center justify-center bg-[hsl(220,20%,18%)] hover:bg-[hsl(220,20%,23%)] text-[hsl(220,15%,60%)] transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                {chatMessages.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                    {chatMessages.length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Device status pills */}
          <div className="flex items-center justify-center gap-2 pb-2">
            <StatusPill ok={cameraOk} label="Câmera" />
            <StatusPill ok={micOk} label="Microfone" />
          </div>

          {/* Speaker test + error banner (mobile) */}
          <div className="flex items-center justify-center gap-2 pb-2">
            <button
              onClick={testSpeaker}
              disabled={speakerTesting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[hsl(220,20%,15%)] text-[hsl(220,15%,70%)] border border-[hsl(220,15%,22%)] active:scale-95 transition disabled:opacity-60"
            >
              <Speaker className={`w-3.5 h-3.5 ${speakerTesting ? "animate-pulse text-primary" : ""}`} />
              {speakerTesting ? "Tocando..." : "Testar som"}
            </button>
          </div>
          {deviceError && !testing && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 mb-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-destructive">{deviceError.message}</p>
                <button
                  onClick={testDevices}
                  className="text-[11px] text-primary underline mt-1"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          {/* Doctor presence status */}
          {!isDoctor && appointmentId && (
            <div className={`rounded-xl border p-3 flex items-center gap-3 mb-2 ${
              doctorPresent
                ? 'bg-[hsl(150,60%,40%,0.08)] border-[hsl(150,60%,40%,0.2)]'
                : 'bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)]'
            }`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                doctorPresent ? 'bg-[hsl(150,60%,40%,0.15)]' : 'bg-primary/10'
              }`}>
                {doctorPresent ? (
                  <CheckCircle2 className="w-5 h-5 text-[hsl(150,60%,50%)]" />
                ) : (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Loader2 className="w-5 h-5 text-primary" />
                  </motion.div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white">
                  {doctorPresent ? "Médico na sala!" : "Aguardando o médico..."}
                </p>
                {waitingPosition !== null && waitingPosition > 0 && !doctorPresent && (
                  <p className="text-[10px] text-[hsl(220,15%,50%)] flex items-center gap-1">
                    <Users className="w-3 h-3" /> Posição: #{waitingPosition}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Enter button */}
          <Button
            className={`w-full h-14 rounded-xl text-base font-semibold shadow-lg transition-all duration-200 active:scale-[0.97] gap-2 ${
              doctorPresent
                ? 'bg-[hsl(150,60%,40%)] hover:bg-[hsl(150,60%,35%)] text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
            onClick={handleEnter}
            disabled={testing}
          >
            <PhoneCall className="w-5 h-5" />
            {doctorPresent ? "Entrar na Consulta" : allGood ? "Entrar na Consulta" : "Entrar mesmo assim"}
          </Button>

          {/* Support link */}
          <div className="text-center pt-2 pb-1">
            <button
              className="text-[11px] text-[hsl(220,15%,45%)] hover:text-primary transition-colors flex items-center gap-1.5 mx-auto"
              onClick={() => navigate("/dashboard/patient/support")}
            >
              <MessageCircle className="w-3 h-3" />
              Problemas? Fale com o Suporte
            </button>
          </div>
        </div>

        {/* Chat bottom sheet */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-[hsl(220,20%,8%)] border-t border-[hsl(220,15%,18%)] rounded-t-2xl"
              style={{ maxHeight: '60dvh', paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(220,15%,15%)]">
                <p className="text-sm font-medium text-white">Chat da sala de espera</p>
                <button onClick={() => setShowChat(false)} aria-label="Fechar chat" className="text-[hsl(220,15%,55%)] hover:text-white">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <div className="h-40 overflow-y-auto px-4 py-2 space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-[hsl(220,15%,40%)] text-center mt-10">
                    Envie uma mensagem enquanto espera...
                  </p>
                )}
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === (isDoctor ? "doctor" : "patient") ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs ${
                      msg.sender === (isDoctor ? "doctor" : "patient")
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-[hsl(220,20%,18%)] text-white rounded-bl-sm"
                    }`}>
                      <p>{msg.text}</p>
                      <p className="text-[9px] opacity-50 mt-0.5">{msg.time}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2 px-4 py-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChatMessage()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 bg-[hsl(220,20%,15%)] border border-[hsl(220,15%,22%)] rounded-xl px-3 py-3 text-sm text-white placeholder:text-[hsl(220,15%,40%)] outline-none focus:border-primary/50 transition-colors"
                />
                <button onClick={sendChatMessage} aria-label="Enviar mensagem" className="text-primary hover:text-primary/80 px-3 min-h-[44px]">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Symptom form bottom sheet */}
        {!isDoctor && appointmentId && showSymptomForm && !symptomsSubmitted && (
          <div className="fixed inset-x-0 bottom-0 z-40 bg-[hsl(220,20%,8%)] border-t border-[hsl(220,15%,18%)] rounded-t-2xl max-h-[70dvh] overflow-y-auto"
               style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}>
            <div className="px-4 py-3">
              <PreConsultationForm
                appointmentId={appointmentId}
                onComplete={() => { setSymptomsSubmitted(true); setShowSymptomForm(false); }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─── DESKTOP LAYOUT ─── */
  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)] flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-5xl"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src={mascotImg} alt="Mascot" className="w-10 h-10" loading="lazy" decoding="async" width={40} height={40} />
            <div>
              <h1 className="text-lg font-bold text-white">
                {isDoctor ? "Preparar Atendimento" : "Pronto para entrar?"}
              </h1>
              <p className="text-xs text-[hsl(220,15%,55%)]">
                Verifique seu áudio e vídeo antes de entrar
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(150,60%,40%,0.15)] border border-[hsl(150,60%,40%,0.25)]">
              <Wifi className="w-3 h-3 text-[hsl(150,60%,45%)]" />
              <span className="text-[11px] text-[hsl(150,60%,55%)] font-medium">Conexão boa</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(220,20%,15%)] border border-[hsl(220,15%,25%)]">
              <Shield className="w-3 h-3 text-[hsl(220,15%,55%)]" />
              <span className="text-[11px] text-[hsl(220,15%,55%)] font-medium">Criptografado</span>
            </div>
          </div>
        </div>

        {/* Main content: two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Left: Video preview */}
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,18%)] shadow-2xl">
              <div className="relative aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${!cameraOn ? 'hidden' : ''}`}
                  style={{ transform: 'scaleX(-1)' }}
                />

                {(!cameraOn || (!cameraOk && !testing)) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[hsl(220,20%,12%)]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-24 h-24 rounded-full bg-[hsl(220,20%,20%)] flex items-center justify-center">
                        <span className="text-4xl font-bold text-[hsl(220,15%,55%)]">
                          {userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-[hsl(220,15%,55%)]">
                        {!cameraOk && !testing ? "Câmera não detectada" : "Câmera desligada"}
                      </p>
                    </div>
                  </div>
                )}

                {testing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[hsl(220,20%,8%,0.7)] backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 animate-spin text-primary" />
                      <p className="text-sm text-[hsl(220,15%,65%)]">Verificando dispositivos...</p>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(220,20%,8%,0.75)] backdrop-blur-md border border-[hsl(220,15%,20%)]">
                    <span className="text-sm font-medium text-white">{userName}</span>
                  </div>
                </div>

                {micOn && micOk && (
                  <div className="absolute bottom-3 right-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[hsl(220,20%,8%,0.75)] backdrop-blur-md border border-[hsl(220,15%,20%)]">
                      <Volume2 className="w-3.5 h-3.5 text-[hsl(150,60%,50%)]" />
                      <div className="flex gap-0.5 items-end h-3">
                        {[0.2, 0.4, 0.6, 0.8, 1].map((threshold, i) => (
                          <motion.div
                            key={i}
                            className={`w-1 rounded-full ${volume >= threshold ? 'bg-[hsl(150,60%,50%)]' : 'bg-[hsl(220,15%,30%)]'}`}
                            animate={{ height: volume >= threshold ? `${60 + i * 10}%` : '30%' }}
                            transition={{ duration: 0.1 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls bar */}
              <div className="flex items-center justify-center gap-3 py-4 bg-[hsl(220,20%,9%)]">
                <button
                  onClick={toggleMic}
                  disabled={!micOk}
                  aria-label={micOn ? "Desligar microfone" : "Ligar microfone"}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                    micOn && micOk
                      ? 'bg-[hsl(220,20%,18%)] hover:bg-[hsl(220,20%,23%)] text-white'
                      : 'bg-destructive/90 hover:bg-destructive text-destructive-foreground'
                  }`}
                  title={micOn ? "Desligar microfone" : "Ligar microfone"}
                >
                  {micOn && micOk ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  {micOk === false && (
                    <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                      <AlertTriangle className="w-2.5 h-2.5 text-destructive-foreground" />
                    </div>
                  )}
                </button>

                <button
                  onClick={toggleCamera}
                  disabled={!cameraOk}
                  aria-label={cameraOn ? "Desligar câmera" : "Ligar câmera"}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                    cameraOn && cameraOk
                      ? 'bg-[hsl(220,20%,18%)] hover:bg-[hsl(220,20%,23%)] text-white'
                      : 'bg-destructive/90 hover:bg-destructive text-destructive-foreground'
                  }`}
                  title={cameraOn ? "Desligar câmera" : "Ligar câmera"}
                >
                  {cameraOn && cameraOk ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
                  {cameraOk === false && (
                    <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                      <AlertTriangle className="w-2.5 h-2.5 text-destructive-foreground" />
                    </div>
                  )}
                </button>

                <div className="w-px h-8 bg-[hsl(220,15%,20%)] mx-1" />

                <button
                  onClick={testDevices}
                  disabled={testing}
                  aria-label="Re-testar dispositivos"
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-[hsl(220,20%,18%)] hover:bg-[hsl(220,20%,23%)] text-[hsl(220,15%,60%)] transition-all duration-200"
                  title="Re-testar dispositivos"
                >
                  <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Device status pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatusPill ok={cameraOk} label="Câmera" />
              <StatusPill ok={micOk} label="Microfone" />
              <button
                onClick={testSpeaker}
                disabled={speakerTesting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[hsl(220,20%,15%)] text-[hsl(220,15%,70%)] border border-[hsl(220,15%,22%)] hover:bg-[hsl(220,20%,18%)] transition disabled:opacity-60"
                title="Tocar som de teste"
              >
                <Speaker className={`w-3.5 h-3.5 ${speakerTesting ? "animate-pulse text-primary" : ""}`} />
                {speakerTesting ? "Tocando..." : "Testar alto-falante"}
              </button>
              {!allGood && !testing && (
                <p className="text-[11px] text-[hsl(220,15%,45%)]">
                  Dispositivos com erro não impedirão sua entrada.
                </p>
              )}
            </div>

            {deviceError && !testing && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-destructive">{deviceError.message}</p>
                  <p className="text-xs text-[hsl(220,15%,55%)] mt-1">
                    Você ainda pode entrar na consulta — o médico continuará por chat e o sistema tentará outra rota de vídeo (Jitsi).
                  </p>
                  <button
                    onClick={testDevices}
                    className="text-xs text-primary underline mt-2 inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Tentar novamente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Info panel */}
          <div className="space-y-4">
            {!isDoctor && (doctorName || scheduledAt) && (
              <div className="rounded-xl bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,18%)] p-4 space-y-3">
                {doctorName && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{doctorName.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{doctorName}</p>
                      {doctorSpecialty && (
                        <p className="text-xs text-[hsl(220,15%,50%)]">{doctorSpecialty}</p>
                      )}
                    </div>
                  </div>
                )}
                {scheduledAt && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-[hsl(220,20%,13%)]">
                    <p className="text-xs text-[hsl(220,15%,55%)]">
                      {format(new Date(scheduledAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                    {countdown !== null && countdown > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-primary" />
                        <span className="text-xs font-mono font-bold text-primary">
                          {formatCountdown(countdown)}
                        </span>
                      </div>
                    )}
                    {countdown !== null && countdown === 0 && (
                      <Badge className="bg-[hsl(150,60%,40%,0.15)] text-[hsl(150,60%,55%)] border-[hsl(150,60%,40%,0.25)] text-[10px]">
                        Horário chegou!
                      </Badge>
                    )}
                  </div>
                )}
                {waitingPosition !== null && waitingPosition > 0 && (
                  <div className="flex items-center gap-2 text-xs text-[hsl(220,15%,55%)]">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    Posição na fila: <strong className="text-primary">#{waitingPosition}</strong>
                  </div>
                )}
              </div>
            )}

            {!isDoctor && appointmentId && (
              <div className={`rounded-xl border p-4 flex items-center gap-3 ${
                doctorPresent
                  ? 'bg-[hsl(150,60%,40%,0.08)] border-[hsl(150,60%,40%,0.2)]'
                  : 'bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)]'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  doctorPresent ? 'bg-[hsl(150,60%,40%,0.15)]' : 'bg-primary/10'
                }`}>
                  {doctorPresent ? (
                    <CheckCircle2 className="w-5 h-5 text-[hsl(150,60%,50%)]" />
                  ) : (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                      <Loader2 className="w-5 h-5 text-primary" />
                    </motion.div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {doctorPresent ? (
                    <>
                      <p className="text-sm font-medium text-[hsl(150,60%,55%)]">Médico na sala!</p>
                      <p className="text-xs text-[hsl(220,15%,50%)]">Clique para entrar na consulta.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-white">
                        {waitingSeconds < 30
                          ? "Aguardando o médico entrar..."
                          : waitingSeconds < 60
                          ? "O médico está sendo notificado..."
                          : "Verificando disponibilidade do médico..."}
                      </p>
                      <p className="text-xs text-[hsl(220,15%,50%)] truncate">
                        {doctorName
                          ? `${doctorName} foi notificado(a)`
                          : "O médico será notificado"}{" "}
                        • {waitingSeconds}s
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            <Button
              className={`w-full h-12 rounded-xl text-sm font-semibold shadow-lg transition-all duration-200 active:scale-[0.98] gap-2 ${
                doctorPresent
                  ? 'bg-[hsl(150,60%,40%)] hover:bg-[hsl(150,60%,35%)] text-white'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              }`}
              onClick={handleEnter}
              disabled={testing}
            >
              <PhoneCall className="w-5 h-5" />
              {doctorPresent ? "Entrar na Consulta" : allGood ? "Entrar na Consulta" : "Entrar mesmo assim"}
            </Button>

            {!isDoctor && appointmentId && (
              <div>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="flex items-center gap-2 text-xs font-medium text-[hsl(220,15%,55%)] hover:text-white transition-colors w-full"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {showChat ? "Fechar chat" : "Chat da sala de espera"}
                  {chatMessages.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                      {chatMessages.length}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {showChat && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-2"
                    >
                      <div className="rounded-xl bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,18%)] p-3">
                        <div className="h-32 overflow-y-auto space-y-2 mb-2">
                          {chatMessages.length === 0 && (
                            <p className="text-xs text-[hsl(220,15%,40%)] text-center mt-8">
                              Envie uma mensagem enquanto espera...
                            </p>
                          )}
                          {chatMessages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.sender === (isDoctor ? "doctor" : "patient") ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs ${
                                msg.sender === (isDoctor ? "doctor" : "patient")
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-[hsl(220,20%,18%)] text-white rounded-bl-sm"
                              }`}>
                                <p>{msg.text}</p>
                                <p className="text-[9px] opacity-50 mt-0.5">{msg.time}</p>
                              </div>
                            </div>
                          ))}
                          <div ref={chatEndRef} />
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && sendChatMessage()}
                            placeholder="Digite uma mensagem..."
                            className="flex-1 bg-[hsl(220,20%,15%)] border border-[hsl(220,15%,22%)] rounded-xl px-3 py-2 text-xs text-white placeholder:text-[hsl(220,15%,40%)] outline-none focus:border-primary/50 transition-colors"
                          />
                          <button onClick={sendChatMessage} aria-label="Enviar mensagem" className="text-primary hover:text-primary/80 px-2">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {!isDoctor && appointmentId && showSymptomForm && !symptomsSubmitted && (
              <PreConsultationForm
                appointmentId={appointmentId}
                onComplete={() => { setSymptomsSubmitted(true); setShowSymptomForm(false); }}
              />
            )}
            {!isDoctor && symptomsSubmitted && (
              <div className="rounded-xl bg-[hsl(150,60%,40%,0.08)] border border-[hsl(150,60%,40%,0.2)] p-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[hsl(150,60%,50%)] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[hsl(150,60%,55%)]">Sintomas enviados</p>
                  <p className="text-xs text-[hsl(220,15%,50%)]">O médico terá acesso aos seus sintomas.</p>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowTips(!showTips)}
              className="flex items-center gap-2 text-xs text-[hsl(220,15%,55%)] hover:text-white transition-colors w-full"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTips ? 'rotate-180' : ''}`} />
              Dicas para a consulta
            </button>
            <AnimatePresence>
              {showTips && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,18%)] p-4 space-y-2">
                    {[
                      { icon: "🎧", text: "Esteja em um lugar silencioso" },
                      { icon: "📶", text: "Verifique sua conexão com a internet" },
                      { icon: "📋", text: "Tenha seus exames em mãos" },
                      { icon: "💡", text: "Boa iluminação ajuda o médico a avaliar" },
                    ].map((tip, i) => (
                      <p key={i} className="text-xs text-[hsl(220,15%,55%)] flex items-center gap-2">
                        <span>{tip.icon}</span> {tip.text}
                      </p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-center pt-2">
              <button
                className="text-[11px] text-[hsl(220,15%,45%)] hover:text-primary transition-colors flex items-center gap-1.5 mx-auto"
                onClick={() => navigate("/dashboard/patient/support")}
              >
                <MessageCircle className="w-3 h-3" />
                Problemas? Fale com o Suporte
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PreCallCheck;
