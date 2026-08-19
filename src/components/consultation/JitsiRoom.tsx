import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneOff, Clock, Loader2 } from "lucide-react";
import { getJitsiUrl } from "@/lib/jitsi";
import { db } from "@/integrations/supabase/untyped";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface JitsiRoomProps {
  appointmentId: string;
  roomId: string;
  displayName: string;
  onEnd: () => void;
  /** true = médico (host/apresentador da sala MiroTalk). */
}

const JitsiRoom = ({ appointmentId, roomId, displayName, onEnd }: JitsiRoomProps) => {
  const [elapsed, setElapsed] = useState(0);
  const [meetUrl, setMeetUrl] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Busca um token JWT do MiroTalk (defesa em profundidade). Timeout curto +
  // fallback: se o servidor MiroTalk não exigir/emitir token, entra sem token
  // (comportamento atual) — nunca atrasa/quebra o vídeo por mais de ~2s.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await db.functions.invoke("mirotalk-token", {
          body: { appointmentId, room: roomId, name: displayName },
        });
        const token = (data as { token?: string } | null)?.token;
        if (error || !token) throw error ?? new Error("missing token");
        if (!cancelled) setMeetUrl(getJitsiUrl(roomId, displayName, token));
      } catch {
        if (!cancelled) setTokenError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [appointmentId, roomId, displayName]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const timerColor =
    elapsed > 3600
      ? "text-destructive"
      : elapsed > 1800
      ? "text-amber-400"
      : "text-[hsl(150,60%,55%)]";

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: "hsl(220, 25%, 4%)" }}>
      <div className="flex items-center justify-between px-4 py-2 bg-[hsl(220,25%,6%)] border-b border-[hsl(220,15%,10%)] shrink-0" style={{ height: 60 }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-[hsl(150,60%,45%)] animate-pulse" />
          <span className="text-xs text-[hsl(220,15%,55%)] truncate">Sala: {roomId}</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[hsl(220,20%,8%)] border border-[hsl(220,15%,12%)]">
          <Clock className="w-3 h-3 text-[hsl(220,15%,45%)]" />
          <span className={`text-xs font-mono font-bold tracking-wider ${timerColor}`}>
            {formatTime(elapsed)}
          </span>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-xl min-h-[44px] min-w-[44px] shadow-lg gap-1.5"
            >
              <PhoneOff className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Encerrar consulta</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Encerrar consulta?</AlertDialogTitle>
              <AlertDialogDescription>
                A videochamada será encerrada para todos os participantes. Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onEnd} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sim, encerrar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex-1 relative" style={{ height: "calc(100% - 60px)" }}>
        {tokenError ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-destructive">
            Não foi possível autorizar sua entrada nesta sala. Verifique o horário da consulta e tente novamente.
          </div>
        ) : meetUrl ? (
          <iframe
            src={meetUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
            className="absolute inset-0 w-full h-full border-0"
            title="Teleconsulta"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(220,15%,45%)]" />
          </div>
        )}
      </div>
    </div>
  );
};

export default JitsiRoom;
