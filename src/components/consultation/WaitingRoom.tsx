import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Loader2, CreditCard, FileSignature, ShieldCheck, ArrowRight, MessageCircle } from "lucide-react";
import mascotImg from "@/assets/states/pingo-sala-espera.webp";

export type CheckState = "ok" | "blocked" | "pending";

export interface WaitingRoomCheck {
  state: CheckState;
  reason?: string;
  hint?: string;
}

interface WaitingRoomProps {
  appointmentId?: string;
  isDoctor: boolean;
  payment: WaitingRoomCheck;
  consent: WaitingRoomCheck;
  participation: WaitingRoomCheck;
  onSignConsent: () => void;
  onContinue: () => void;
}

const stateIcon = (s: CheckState) => {
  if (s === "ok") return <CheckCircle2 className="w-5 h-5 text-[hsl(150,60%,55%)]" />;
  if (s === "blocked") return <AlertTriangle className="w-5 h-5 text-destructive" />;
  return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
};

const stateBadge = (s: CheckState) => {
  if (s === "ok") return "bg-[hsl(150,60%,40%,0.12)] text-[hsl(150,60%,55%)] border-[hsl(150,60%,40%,0.25)]";
  if (s === "blocked") return "bg-destructive/10 text-destructive border-destructive/25";
  return "bg-primary/10 text-primary border-primary/25";
};

const stateLabel = (s: CheckState) => (s === "ok" ? "OK" : s === "blocked" ? "Bloqueado" : "Verificando...");

const WaitingRoom = ({ appointmentId, isDoctor, payment, consent, participation, onSignConsent, onContinue }: WaitingRoomProps) => {
  const navigate = useNavigate();
  const allOk = payment.state === "ok" && consent.state === "ok" && participation.state === "ok";
  const anyPending = [payment, consent, participation].some(c => c.state === "pending");

  const checks: Array<{
    key: string;
    icon: JSX.Element;
    title: string;
    description: string;
    check: WaitingRoomCheck;
    action?: { label: string; onClick: () => void; variant?: "default" | "outline" };
  }> = [
    {
      key: "payment",
      icon: <CreditCard className="w-5 h-5" />,
      title: "Pagamento confirmado",
      description: isDoctor
        ? "O pagamento do paciente é validado antes da entrada."
        : "Sua consulta só é liberada após a confirmação do pagamento.",
      check: payment,
      action: payment.state === "blocked" && !isDoctor && appointmentId
        ? { label: "Pagar agora", onClick: () => navigate(`/dashboard/appointments/${appointmentId}`) }
        : undefined,
    },
    {
      key: "consent",
      icon: <FileSignature className="w-5 h-5" />,
      title: isDoctor ? "Consentimento do paciente (TCLE)" : "Termo de Consentimento (TCLE)",
      description: isDoctor
        ? "O paciente precisa aceitar o TCLE para iniciar a teleconsulta."
        : "Você precisa ler e aceitar o Termo de Consentimento Livre e Esclarecido antes de entrar.",
      check: consent,
      action: consent.state === "blocked" && !isDoctor
        ? { label: "Ler e assinar TCLE", onClick: onSignConsent }
        : undefined,
    },
    {
      key: "participation",
      icon: <ShieldCheck className="w-5 h-5" />,
      title: "Participação autorizada",
      description: isDoctor
        ? "Verificamos se você é o médico responsável e se seu CRM está validado."
        : "Verificamos se você é o paciente desta consulta e se ela está ativa.",
      check: participation,
      action: participation.state === "blocked"
        ? { label: "Voltar ao Dashboard", onClick: () => navigate("/dashboard"), variant: "outline" }
        : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)] flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <img src={mascotImg} alt="Mascote" className="w-12 h-12" loading="lazy" decoding="async" width={48} height={48} />
          <div>
            <h1 className="text-xl font-bold text-white">Sala de espera</h1>
            <p className="text-xs text-[hsl(220,15%,55%)]">
              Confira as etapas obrigatórias antes de entrar na consulta.
            </p>
          </div>
        </div>

        {/* Checklist */}
        <div className="rounded-2xl bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,16%)] overflow-hidden divide-y divide-[hsl(220,15%,14%)]">
          {checks.map(({ key, icon, title, description, check, action }) => (
            <div key={key} className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[hsl(220,20%,13%)] border border-[hsl(220,15%,18%)] flex items-center justify-center shrink-0 text-[hsl(220,15%,60%)]">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${stateBadge(check.state)}`}>
                    {stateIcon(check.state)} {stateLabel(check.state)}
                  </span>
                </div>
                <p className="text-xs text-[hsl(220,15%,55%)] mt-1 leading-relaxed">{description}</p>
                {check.state === "blocked" && check.reason && (
                  <div className="mt-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2">
                    <p className="text-[11px] text-destructive font-medium">{check.reason}</p>
                    {check.hint && (
                      <p className="text-[11px] text-[hsl(220,15%,60%)] mt-0.5">{check.hint}</p>
                    )}
                  </div>
                )}
                {action && (
                  <Button
                    size="sm"
                    variant={action.variant ?? "default"}
                    onClick={action.onClick}
                    className="mt-3 h-8 rounded-lg text-xs"
                  >
                    {action.label}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-6 space-y-3">
          <Button
            className="w-full h-12 rounded-xl text-sm font-semibold gap-2"
            onClick={onContinue}
            disabled={!allOk}
          >
            {allOk ? (
              <>Continuar para pré-checagem de áudio/vídeo <ArrowRight className="w-4 h-4" /></>
            ) : anyPending ? (
              <>Verificando requisitos... <Loader2 className="w-4 h-4 animate-spin" /></>
            ) : (
              "Resolva os bloqueios acima para continuar"
            )}
          </Button>
          <div className="flex items-center justify-between">
            <button
              className="text-[11px] text-[hsl(220,15%,55%)] hover:text-white transition-colors flex items-center gap-1.5"
              onClick={() => navigate("/dashboard")}
            >
              Voltar ao Dashboard
            </button>
            <button
              className="text-[11px] text-[hsl(220,15%,55%)] hover:text-primary transition-colors flex items-center gap-1.5"
              onClick={() => navigate("/dashboard/patient/support")}
            >
              <MessageCircle className="w-3 h-3" /> Falar com o Suporte
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default WaitingRoom;
