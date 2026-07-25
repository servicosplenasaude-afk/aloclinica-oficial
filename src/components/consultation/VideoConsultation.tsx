/**
 * VideoConsultation — Componente de vídeo P2P nativo via WebRTC
 * 
 * Compatível com PC e Mobile (touch targets, safe areas, câmera flip).
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { UserRound, VideoOff, Monitor, MonitorOff, Circle, Download } from "lucide-react";
import { motion } from "framer-motion";
import { useWebRTC, type CallStatus } from "@/hooks/use-webrtc";
import { useRecording } from "@/hooks/use-recording";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

export interface VideoConsultationHandle {
  hangUp: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  switchCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  downloadRecording: (filename?: string) => void;
  requestPiP: () => Promise<void>;
  captureSnapshot: () => string | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  hasRecording: boolean;
  recordingDuration: number;
  status: CallStatus;
}

interface VideoConsultationProps {
  appointmentId: string;
  /** Identificador da sala de sinalização (segredo por consulta). Cai no
   *  appointmentId se não informado — mantém compatibilidade e sem regressão. */
  roomId?: string;
  userName?: string;
  onEndCall: () => void;
  onStatusChange?: (status: CallStatus) => void;
}

const STATUS_LABELS: Record<CallStatus, string> = {
  idle: "Preparando...",
  requesting_media: "Acessando câmera e microfone...",
  waiting_peer: "Aguardando outro participante...",
  connecting: "Conectando...",
  connected: "Conectado",
  reconnecting: "Reconectando...",
  ended: "Chamada encerrada",
  failed: "Falha na conexão",
};

const VideoConsultation = forwardRef<VideoConsultationHandle, VideoConsultationProps>(
  ({ appointmentId, roomId, userName, onEndCall, onStatusChange }, ref) => {
    const { user, roles } = useAuth();
    const isMobile = useIsMobile();
    const isDoctor = roles.includes("doctor") || roles.includes("admin");

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const screenVideoRef = useRef<HTMLVideoElement>(null);
    const remoteScreenVideoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const {
      localStream,
      remoteStream,
      screenStream,
      remoteScreenStream,
      status,
      isMuted,
      isVideoOff,
      isScreenSharing,
      toggleMute,
      toggleVideo,
      switchCamera,
      toggleScreenShare,
      hangUp,
      startCall,
    } = useWebRTC({
      // Sala de sinalização = segredo por consulta (não o appointmentId, que vaza
      // no link). Fallback ao appointmentId mantém o comportamento antigo.
      roomId: roomId ?? appointmentId,
      userId: user?.id || "anonymous",
      isInitiator: isDoctor,
      displayName: userName,
    });

    const {
      status: recordingStatus,
      recordingDuration,
      recordedBlob,
      startRecording: startRecordingInternal,
      stopRecording: stopRecordingInternal,
      downloadRecording,
      isRecording,
      hasRecording,
    } = useRecording({
      mimeType: "video/webm",
      videoBitsPerSecond: 2500000,
      audioBitsPerSecond: 128000,
    });

    // Picture-in-Picture: destaca o vídeo do paciente em janela flutuante
    const requestPiP = async () => {
      const v = remoteVideoRef.current;
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (v && (v as any).requestPictureInPicture && v.videoWidth) {
          await (v as any).requestPictureInPicture();
        }
      } catch {
        /* PiP indisponível neste navegador */
      }
    };

    // Snapshot clínico: captura um quadro do vídeo do paciente (data URL JPEG)
    const captureSnapshot = (): string | null => {
      const v = remoteVideoRef.current;
      if (!v || !v.videoWidth || !v.videoHeight) return null;
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.92);
    };

    useImperativeHandle(ref, () => ({
      hangUp,
      toggleMute,
      toggleVideo,
      switchCamera,
      toggleScreenShare,
      startRecording,
      stopRecording,
      downloadRecording,
      requestPiP,
      captureSnapshot,
      isMuted,
      isVideoOff,
      isScreenSharing,
      isRecording,
      hasRecording,
      recordingDuration,
      status,
    }), [hangUp, toggleMute, toggleVideo, switchCamera, toggleScreenShare, isMuted, isVideoOff, isScreenSharing, isRecording, hasRecording, recordingDuration, status]);

    useEffect(() => {
      onStatusChange?.(status);
    }, [status, onStatusChange]);

    // ─── Criar stream combinado para gravação ───────────────────────────────────
    const createRecordingStream = useRef(() => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const recordingStream = new MediaStream();

        // Adicionar áudio local
        if (localStream) {
          localStream.getAudioTracks().forEach((track) => {
            recordingStream.addTrack(track);
          });
        }

        // Adicionar áudio remoto
        if (remoteStream) {
          remoteStream.getAudioTracks().forEach((track) => {
            recordingStream.addTrack(track);
          });
        }

        // Adicionar vídeo local
        if (localStream) {
          localStream.getVideoTracks().forEach((track) => {
            recordingStream.addTrack(track);
          });
        }

        // Adicionar vídeo remoto
        if (remoteStream) {
          remoteStream.getVideoTracks().forEach((track) => {
            recordingStream.addTrack(track);
          });
        }

        // Adicionar vídeo de tela compartilhada (se existir)
        if (screenStream) {
          screenStream.getVideoTracks().forEach((track) => {
            recordingStream.addTrack(track);
          });
        }

        return recordingStream;
      } catch (err) {
        console.error("Error creating recording stream:", err);
        return new MediaStream();
      }
    });

    const startRecording = () => {
      const recordingStream = createRecordingStream.current();
      startRecordingInternal(recordingStream);
    };

    const stopRecording = () => {
      stopRecordingInternal();
    };

    // Iniciar chamada automaticamente
    useEffect(() => {
      startCall();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Vincular streams aos elementos de vídeo
    useEffect(() => {
      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }, [localStream]);

    useEffect(() => {
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    }, [remoteStream]);

    useEffect(() => {
      if (screenVideoRef.current && screenStream) {
        screenVideoRef.current.srcObject = screenStream;
      }
    }, [screenStream]);

    useEffect(() => {
      if (remoteScreenVideoRef.current && remoteScreenStream) {
        remoteScreenVideoRef.current.srcObject = remoteScreenStream;
      }
    }, [remoteScreenStream]);

    // Som de entrada (beep suave)
    useEffect(() => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.35);
      } catch {
        // ignore — some mobile browsers block autoplay audio
      }
    }, []);

    // Se outro lado desligou
    useEffect(() => {
      if (status === "ended") {
        onEndCall();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    const isWaiting = status === "idle" || status === "requesting_media" || status === "waiting_peer";
    const isActive = status === "connected" || status === "connecting" || status === "reconnecting";
    const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().some(t => t.enabled);
    const hasRemoteScreen = remoteScreenStream && remoteScreenStream.getVideoTracks().some(t => t.enabled);
    const hasLocalScreen = screenStream && screenStream.getVideoTracks().some(t => t.enabled);

    const formatDurationDisplay = (seconds: number): string => {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${secs.toString().padStart(2, "0")}`;
    };

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden touch-none"
        style={{ background: "hsl(220, 25%, 4%)" }}
      >
        {/* ===== VÍDEO REMOTO — tela cheia ===== */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 w-full h-full object-cover z-[1] transition-opacity duration-500 ${
            hasRemoteVideo && isActive ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* ===== Screen Share — Tela cheia quando ativado ===== */}
        {(hasLocalScreen || hasRemoteScreen) && (
          <video
            ref={hasLocalScreen ? screenVideoRef : remoteScreenVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-contain z-[2] bg-black"
          />
        )}

        {/* ===== Placeholder quando sem vídeo remoto ===== */}
        {(!hasRemoteVideo || !isActive) && !hasRemoteScreen && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center">
            <div className="flex flex-col items-center gap-5">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-[hsl(220,20%,12%)] border-2 border-[hsl(220,15%,20%)] flex items-center justify-center">
                <UserRound className="w-12 h-12 md:w-14 md:h-14 text-[hsl(220,15%,40%)]" />
              </div>
              <div className="text-center space-y-2 px-4">
                <p className="text-sm md:text-base font-medium text-white">
                  {STATUS_LABELS[status]}
                </p>
                {isWaiting && (
                  <div className="flex gap-1.5 justify-center">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-emerald-500"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                )}
                {status === "failed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startCall()}
                    className="mt-2 border-white/20 text-white hover:bg-white/10 min-h-[44px] min-w-[44px] rounded-xl"
                  >
                    Tentar novamente
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== VÍDEO LOCAL — miniatura PIP ===== */}
        <motion.div
          drag
          dragConstraints={containerRef}
          dragElastic={0.1}
          dragMomentum={false}
          className={`absolute z-10 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 ${
            isMobile ? "bottom-4 right-3 w-[100px] h-[140px]" : "bottom-4 right-4 w-44 h-32"
          }`}
          style={{ touchAction: "none" }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${isVideoOff ? "hidden" : ""}`}
            style={{ transform: "scaleX(-1)" }}
          />
          {isVideoOff && (
            <div className="w-full h-full bg-[hsl(220,20%,12%)] flex items-center justify-center">
              <VideoOff className="w-6 h-6 text-[hsl(220,15%,40%)]" />
            </div>
          )}
          <div className="absolute bottom-1 left-1 px-2 py-0.5 rounded bg-black/50 text-[10px] text-white font-medium">
            Você
          </div>
        </motion.div>

        {/* ===== Controles de Vídeo — Bottom Center ===== */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 z-20 flex justify-center items-center gap-3 pb-6 px-4"
          >
            <Button
              onClick={toggleMute}
              variant={isMuted ? "destructive" : "default"}
              size="lg"
              className="rounded-full w-12 h-12 p-0 min-h-[48px] min-w-[48px]"
              title={isMuted ? "Desmutetar" : "Mutetar"}
            >
              {isMuted ? "🔇" : "🔊"}
            </Button>

            <Button
              onClick={toggleVideo}
              variant={isVideoOff ? "destructive" : "default"}
              size="lg"
              className="rounded-full w-12 h-12 p-0 min-h-[48px] min-w-[48px]"
              title={isVideoOff ? "Ligar câmera" : "Desligar câmera"}
            >
              {isVideoOff ? "📹" : "🎥"}
            </Button>

            {isMobile && (
              <Button
                onClick={switchCamera}
                variant="outline"
                size="lg"
                className="rounded-full w-12 h-12 p-0 min-h-[48px] min-w-[48px] border-white/20 text-white"
                title="Trocar câmera"
              >
                🔄
              </Button>
            )}

            <Button
              onClick={toggleScreenShare}
              variant={isScreenSharing ? "default" : "outline"}
              size="lg"
              className={`rounded-full w-12 h-12 p-0 min-h-[48px] min-w-[48px] ${
                isScreenSharing
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "border-white/20 text-white hover:bg-white/10"
              }`}
              title={isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}
              aria-label={isScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"}
            >
              {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            </Button>

            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "outline"}
              size="lg"
              className={`rounded-full w-12 h-12 p-0 min-h-[48px] min-w-[48px] ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "border-white/20 text-white hover:bg-white/10"
              }`}
              title={isRecording ? "Parar gravação" : "Iniciar gravação"}
            >
              {isRecording ? (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                >
                  <Circle className="w-5 h-5 fill-current" />
                </motion.div>
              ) : (
                "🔴"
              )}
            </Button>

            {hasRecording && !isRecording && (
              <Button
                onClick={() => downloadRecording(`consulta-${new Date().toISOString().slice(0, 10)}.webm`)}
                variant="outline"
                size="lg"
                className="rounded-full w-12 h-12 p-0 min-h-[48px] min-w-[48px] border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                title="Baixar gravação"
              >
                <Download className="w-5 h-5" />
              </Button>
            )}

            <Button
              onClick={hangUp}
              variant="destructive"
              size="lg"
              className="rounded-full w-12 h-12 p-0 min-h-[48px] min-w-[48px]"
              title="Encerrar chamada"
            >
              ☎️
            </Button>
          </motion.div>
        )}

        {/* ===== Indicador de reconexão ===== */}
        {status === "reconnecting" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-amber-500/90 text-white text-xs font-medium flex items-center gap-2 shadow-lg backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Reconectando...
          </div>
        )}

        {/* ===== Indicador de Compartilhamento ===== */}
        {isScreenSharing && (
          <div className="absolute top-4 right-4 z-20 px-3 py-2 rounded-full bg-blue-600/90 text-white text-xs font-medium flex items-center gap-2 shadow-lg backdrop-blur-sm">
            <Monitor className="w-3 h-3" />
            Compartilhando tela
          </div>
        )}

        {/* ===== Indicador de Gravação ===== */}
        {isRecording && (
          <div className="absolute top-4 left-4 z-20 px-3 py-2 rounded-full bg-red-600/90 text-white text-xs font-medium flex items-center gap-2 shadow-lg backdrop-blur-sm">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              <Circle className="w-3 h-3 fill-current" />
            </motion.div>
            Gravando {recordingDuration > 0 && `(${formatDurationDisplay(recordingDuration)})`}
          </div>
        )}
      </div>
    );
  }
);

VideoConsultation.displayName = "VideoConsultation";

export default VideoConsultation;
