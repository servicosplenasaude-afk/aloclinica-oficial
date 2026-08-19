import { logError } from "@/lib/logger";
import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Shield, FileCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ConsentTCLEProps {
  appointmentId: string;
  doctorName?: string;
  onConsented: () => void;
}

const TCLE_VERSION = "2.0";

const TCLE_TEXT = `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA TELECONSULTA — versão ${TCLE_VERSION}

Conforme Resolução CFM nº 2.314/2022 (telemedicina), Lei nº 14.510/2022 (Marco Legal), Resolução CFM nº 2.299/2021 (prescrição eletrônica), Lei nº 14.063/2020 (assinatura eletrônica) e Lei nº 13.709/2018 (LGPD), declaro que:

1. NATUREZA DO ATENDIMENTO E AUTORIZAÇÃO (Art. 15)
A consulta será realizada por tecnologias digitais de comunicação (teleconsulta). Autorizo expressamente o atendimento por TELEMEDICINA e a captação, TRANSMISSÃO, armazenamento e processamento das imagens, vídeo, áudio e dados clínicos necessários à realização do atendimento. Este atendimento tem limitações inerentes à ausência de exame físico presencial.

2. ATENDIMENTO PRESENCIAL E EMERGÊNCIA (Art. 19)
Tenho DIREITO A ATENDIMENTO PRESENCIAL sempre que preferir ou quando houver indicação médica, e estou ciente de que a teleconsulta NÃO substitui a consulta presencial nessas situações. O médico pode, a qualquer momento, encaminhar-me para atendimento presencial se julgar necessário. Em caso de urgência ou emergência, devo procurar SAMU 192 ou o pronto-socorro mais próximo IMEDIATAMENTE.

3. SIGILO, LGPD E COMPARTILHAMENTO DE DADOS (Art. 15, §único)
Meus dados são tratados conforme LGPD. Servidores no Brasil. Criptografia em trânsito (TLS 1.3) e em repouso (AES-256). Estou ciente de que meus dados pessoais e de saúde PODEM SER COMPARTILHADOS com o médico atendente e com terceiros estritamente necessários ao atendimento, e de que tenho o DIREITO DE NEGAR essa permissão de compartilhamento — salvo em caso de EMERGÊNCIA MÉDICA, quando o compartilhamento independe da minha autorização. Posso exercer meus direitos LGPD via dpo@aloclinica.com.br: acesso, correção, portabilidade, eliminação (respeitada retenção de prontuário de 20 anos pela CFM 1.821/2007).

4. CONSENTIMENTO E REVOGAÇÃO
Autorizo voluntariamente a teleconsulta. Estou ciente de que:
• O médico pode encaminhar para atendimento presencial se julgar necessário;
• Receitas e atestados são emitidos digitalmente com assinatura eletrônica válida (Lei 14.063/2020);
• Receitas de medicamentos controlados podem requerer certificado ICP-Brasil do médico;
• Posso revogar este consentimento a qualquer momento antes da consulta.

5. GRAVAÇÃO
A teleconsulta NÃO será gravada salvo com meu consentimento expresso adicional. Se gravada, será apenas para finalidade clínica legítima (segunda opinião, auditoria de qualidade), nunca comercial.

6. PRONTUÁRIO E REGISTROS
Os dados clínicos serão registrados em prontuário eletrônico, retidos por 20 anos conforme Resolução CFM 1.821/2007. Acessível apenas ao médico responsável e ao paciente.

7. PAGAMENTO E NO-SHOW
Pagamento processado pelo Mercado Pago (PSP licenciado pelo BACEN). Não comparecimento sem cancelamento prévio com 2h de antecedência: taxa de 50% do valor da consulta. Reembolsos seguem o CDC.

8. DIREITOS DO PACIENTE
Tenho direito a: receber informações claras sobre diagnóstico e tratamento; acessar meu prontuário; solicitar encaminhamento presencial; revogar consentimento a qualquer momento; segunda opinião médica.

9. RESPONSABILIDADES
Médico: responde tecnicamente conforme Código de Ética Médica e CRM ativo verificado.
Plataforma: responde por disponibilidade técnica (SLA 99% mensal) e segurança dos dados. Não responde por conduta médica individual nem falhas de conexão do paciente.

10. ACEITE
Ao clicar "Aceitar e Iniciar Consulta", declaro ter lido e compreendido este termo, manifesto consentimento livre e esclarecido, autorizo o tratamento de dados conforme LGPD. O aceite é registrado com data/hora UTC, IP, User-Agent e versão.

Texto completo: https://aloclinica.com.br/termo-telemedicina`;

const ConsentTCLE = ({ appointmentId, doctorName, onConsented }: ConsentTCLEProps) => {
  const { user } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const listenerAttached = useRef(false);

  const handleScroll = useCallback((e: Event) => {
    const el = e.target as HTMLElement;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      setScrolledToEnd(true);
    }
  }, []);

  // Attach scroll listener once to Radix viewport, with proper cleanup
  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node || listenerAttached.current) return;

    const viewport = node.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    listenerAttached.current = true;
    viewport.addEventListener('scroll', handleScroll);

    // If content fits without scrolling, enable immediately
    if (viewport.scrollHeight <= viewport.clientHeight + 40) {
      setScrolledToEnd(true);
    }

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      listenerAttached.current = false;
    };
  }, [handleScroll]);

  const handleAccept = async () => {
    if (!user || !accepted || !acceptedPrivacy) return;
    setSubmitting(true);

    try {
      const { error } = await (db as any).from("patient_consents").insert({
        patient_id: user.id,
        appointment_id: appointmentId,
        consent_type: "telemedicine_tcle",
        consent_text: TCLE_TEXT,
        accepted_at: new Date().toISOString(),
        ip_address: null,
        user_agent: navigator.userAgent.slice(0, 500),
      });

      if (error) throw error;

      toast.success("Consentimento registrado ✅", { description: "Seu TCLE foi aceito e registrado com segurança." });
      onConsented();
    } catch (err: unknown) {
      logError("ConsentTCLE error", err);
      toast.error("Erro ao registrar consentimento", { description: err instanceof Error ? err.message : "Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen bg-background flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary/5 border-b border-border px-6 py-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Termo de Consentimento (TCLE)
            </h2>
            <p className="text-sm text-muted-foreground">
              Resolução CFM nº 2.314/2022 — Leia antes de prosseguir
            </p>
          </div>
        </div>

        {/* Doctor info */}
        {doctorName && (
          <div className="px-6 py-3 bg-muted/30 border-b border-border">
            <p className="text-sm text-muted-foreground">
              Teleconsulta com <span className="font-semibold text-foreground">{doctorName}</span>
            </p>
          </div>
        )}

        {/* TCLE content */}
        <div className="px-6 py-4">
          <div ref={scrollContainerRef}>
            <ScrollArea className="h-[300px] rounded-lg border border-border bg-muted/20 p-4">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                {TCLE_TEXT}
              </pre>
            </ScrollArea>
          </div>

          {!scrolledToEnd && (
            <div className="flex items-center gap-2 mt-2 text-xs text-warning">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Role até o final do documento para habilitar o aceite</span>
            </div>
          )}
        </div>

        {/* Checkboxes */}
        <div className="px-6 pb-2 space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="accept-tcle"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              disabled={!scrolledToEnd}
            />
            <Label htmlFor="accept-tcle" className="text-sm leading-snug cursor-pointer">
              Declaro que li e compreendi o Termo de Consentimento Livre e Esclarecido acima
              e autorizo a realização da teleconsulta.
            </Label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="accept-privacy"
              checked={acceptedPrivacy}
              onCheckedChange={(v) => setAcceptedPrivacy(v === true)}
              disabled={!scrolledToEnd}
            />
            <Label htmlFor="accept-privacy" className="text-sm leading-snug cursor-pointer">
              Concordo com o tratamento dos meus dados conforme a LGPD
              (Lei nº 13.709/2018) e a Política de Privacidade da plataforma.
            </Label>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-5 border-t border-border flex justify-end gap-3">
          <Button
            onClick={handleAccept}
            disabled={!accepted || !acceptedPrivacy || submitting}
            className="gap-2"
            size="lg"
          >
            <FileCheck className="w-4 h-4" />
            {submitting ? "Registrando..." : "Aceitar e Iniciar Consulta"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ConsentTCLE;
