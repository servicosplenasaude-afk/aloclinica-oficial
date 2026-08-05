/**
 * KycRequiredGate — bloqueia acesso a fluxos críticos sem KYC aprovado.
 *
 * Uso:
 *   <KycRequiredGate>
 *     <BookAppointment />  // só renderiza se paciente passou KYC
 *   </KycRequiredGate>
 *
 * Comportamento:
 *   - loading → spinner
 *   - sem usuário → redireciona para /paciente
 *   - sem KYC aprovado → mostra UI de chamada para verificar (deep link para /kyc)
 *   - com KYC aprovado → renderiza children
 *
 * Aceita médico tb (verifica doctor_profiles.kyc_status).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Loader2, AlertCircle, Camera, ArrowRight, Clock, MessageCircle, Mail } from "lucide-react";
import { warn } from "@/lib/logger";
import { supportContactUrl } from "@/config/compliance";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Props = {
  children: React.ReactNode;
  /** Quando o paciente termina o KYC, para onde voltar (default = página atual) */
  returnTo?: string;
  /** Texto contextual: por que estamos pedindo KYC agora? */
  reason?: string;
};

type KycState = "loading" | "approved" | "missing" | "rejected" | "pending";

type LastAttempt = {
  status: string;
  similarity: number | null;
  created_at: string;
} | null;

export function KycRequiredGate({ children, returnTo, reason }: Props) {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<KycState>("loading");
  const [lastAttempt, setLastAttempt] = useState<LastAttempt>(null);
  const isDoctor = roles.includes("doctor") || roles.includes("admin");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState("missing");
      return;
    }
    // Admin sempre passa (acesso operacional)
    if (roles.includes("admin")) {
      setState("approved");
      return;
    }

    const check = async () => {
      try {
        // 1. Buscar verificação biométrica mais recente
        const { data: verif } = await (db as any)
          .from("kyc_verificacoes")
          .select("status, similarity, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (verif) setLastAttempt(verif);

        if (verif?.status === "approved" || verif?.status === "aprovado") {
          // 2. Para médico, validar também doctor_profiles.kyc_status
          if (isDoctor) {
            const { data: doc } = await db
              .from("doctor_profiles")
              .select("kyc_status")
              .eq("user_id", user.id)
              .maybeSingle();
            if (doc?.kyc_status === "approved" || doc?.kyc_status === "verified") {
              setState("approved");
              return;
            }
            setState("pending");
            return;
          }
          setState("approved");
          return;
        }

        if (verif?.status === "rejected" || verif?.status === "reprovado") {
          setState("rejected");
          return;
        }

        setState("missing");
      } catch (e) {
        warn("[KycRequiredGate] erro verificando KYC", e);
        setState("missing");
      }
    };

    check();
  }, [user, authLoading, roles, isDoctor]);

  if (authLoading || state === "loading") {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/paciente", { replace: true });
    return null;
  }

  if (state === "approved") {
    return <>{children}</>;
  }

  // Não aprovado → CTA para fazer KYC
  const target = returnTo ?? window.location.pathname;
  const goToKyc = () => navigate(`/kyc?return=${encodeURIComponent(target)}`);

  // Calcula motivo provável da rejeição baseado no score
  const rejectionReason = lastAttempt?.similarity != null
    ? lastAttempt.similarity < 0.5
      ? "Selfie e documento parecem ser pessoas diferentes"
      : lastAttempt.similarity < 0.8
        ? "Foto borrada ou com pouca luz"
        : "Por pouco — tente uma foto mais nítida"
    : "Documento ilegível ou rosto não detectado";

  // Pode tentar de novo após 5 minutos da última tentativa rejeitada
  const minutesSinceLast = lastAttempt
    ? (Date.now() - new Date(lastAttempt.created_at).getTime()) / 60000
    : null;
  const canRetryNow = state === "rejected" && (minutesSinceLast == null || minutesSinceLast >= 5);
  const minutesToWait = minutesSinceLast != null ? Math.max(0, Math.ceil(5 - minutesSinceLast)) : 0;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ${
            state === "rejected" ? "bg-destructive/10" :
            state === "pending" ? "bg-amber-500/10" :
            "bg-primary/10"
          }`}>
            {state === "rejected" ? <AlertCircle className="w-8 h-8 text-destructive" /> :
             state === "pending" ? <Clock className="w-8 h-8 text-amber-600" /> :
             <ShieldCheck className="w-8 h-8 text-primary" />}
          </div>
          <CardTitle className="text-xl">
            {state === "rejected" ? "Verificação não aprovada" :
             state === "pending" ? "Em análise" :
             "Verificação obrigatória"}
          </CardTitle>
          <CardDescription className="mt-2">
            {reason ?? "Antes de prosseguir, precisamos confirmar sua identidade com um documento e uma selfie. É rápido (1 minuto) e protege você e o profissional."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "rejected" && lastAttempt && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                <div className="flex-1">
                  <div className="font-medium text-destructive">Motivo provável</div>
                  <div className="text-muted-foreground mt-0.5">{rejectionReason}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-destructive/20">
                <Clock className="w-3 h-3" />
                Última tentativa há {formatDistanceToNow(new Date(lastAttempt.created_at), { locale: ptBR })}
                {lastAttempt.similarity != null && (
                  <span className="ml-1">· {Math.round(lastAttempt.similarity * 100)}% de similaridade</span>
                )}
              </div>
            </div>
          )}
          {state === "pending" && isDoctor && (
            <div className="rounded-lg border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <Clock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <div className="font-medium text-amber-700 dark:text-amber-400">Análise em andamento</div>
                  <div className="text-muted-foreground mt-0.5">
                    Sua biometria foi recebida. Compliance analisa em até 24h.
                    Você receberá email no aprovado/rejeitado.
                  </div>
                </div>
              </div>
              {lastAttempt && (
                <div className="text-xs text-muted-foreground pt-1 border-t border-amber-200/40">
                  Enviado {format(new Date(lastAttempt.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </div>
              )}
            </div>
          )}
          {state === "missing" && (
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-center gap-2"><Camera className="w-4 h-4" /> Selfie ao vivo (não vale foto antiga)</li>
              <li className="flex items-center gap-2"><Camera className="w-4 h-4" /> Documento com foto (RG, CNH, passaporte)</li>
              <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Os dados são processados de forma criptografada</li>
            </ul>
          )}

          {/* Botão principal — varia por estado */}
          {state === "pending" ? (
            <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full" size="lg">
              Voltar para o painel
            </Button>
          ) : (
            <Button
              onClick={goToKyc}
              disabled={!canRetryNow && state === "rejected"}
              className="w-full gap-2"
              size="lg"
            >
              {state === "rejected"
                ? canRetryNow
                  ? <>Tentar novamente <ArrowRight className="w-4 h-4" /></>
                  : <>Aguarde {minutesToWait} min para tentar de novo</>
                : <>Iniciar verificação <ArrowRight className="w-4 h-4" /></>}
            </Button>
          )}

          {/* Suporte */}
          {(state === "rejected" || state === "pending") && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <a href="mailto:suporte@aloclinica.com.br?subject=Ajuda%20com%20verifica%C3%A7%C3%A3o%20de%20identidade" className="gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <a
                  href={supportContactUrl("Olá! Preciso de ajuda com a verificação de identidade na AloClínica.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </Button>
            </div>
          )}

          <Button onClick={() => navigate(-1)} variant="ghost" className="w-full text-xs">
            Voltar para a página anterior
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default KycRequiredGate;
