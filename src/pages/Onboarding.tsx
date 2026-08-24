import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Video, Stethoscope, ArrowRight, ArrowLeft, Check } from "lucide-react";
import pingoHello from "@/assets/logo-pingo.png";
import pingoCalendar from "@/assets/visual-system/pingo-calendario-onboarding.webp";
import pingoVideo from "@/assets/visual-system/pingo-onboarding.webp";

const STORAGE_KEY = "alo_onboarding_v1_done";

type Step = {
  title: string;
  description: string;
  bullets: string[];
  image: string;
  icon: typeof CalendarCheck;
  alt: string;
};

const steps: Step[] = [
  {
    title: "Olá! Eu sou o Pingo",
    description:
      "Seu assistente da Aló Clínica. Vou te mostrar, em três passos, como agendar uma consulta e iniciar sua telemedicina com segurança.",
    bullets: [
      "Atendimento 100% online por médicos verificados (CFM)",
      "Pagamento seguro com recibo enviado por e-mail",
      "Receita e atestado digitais válidos em todo o Brasil",
    ],
    image: pingoHello,
    icon: Stethoscope,
    alt: "Pingo, mascote pinguim da Aló Clínica vestindo jaleco",
  },
  {
    title: "Agende em menos de 2 minutos",
    description:
      "Escolha a especialidade, compare médicos disponíveis e selecione o horário que cabe na sua rotina.",
    bullets: [
      "Busque por especialidade ou sintoma",
      "Veja preço, avaliações e próximos horários",
      "Confirme o pagamento via Pix ou cartão",
    ],
    image: pingoCalendar,
    icon: CalendarCheck,
    alt: "Pingo segurando uma agenda para marcar consulta",
  },
  {
    title: "Inicie sua teleconsulta",
    description:
      "No horário marcado, entre na sala de vídeo direto pelo navegador — sem instalar nada. O Pingo te avisa antes pelo WhatsApp.",
    bullets: [
      "Sala segura, criptografada e privada",
      "Funciona no celular, tablet ou computador",
      "Prescrição enviada pelo app ao final",
    ],
    image: pingoVideo,
    icon: Video,
    alt: "Pingo em uma videochamada de telemedicina",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const Icon = step.icon;

  useEffect(() => {
    document.title = "Bem-vindo à Aló Clínica | Como funciona";
  }, []);

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* noop */
    }
    navigate("/agendar");
  };

  const skip = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* noop */
    }
    navigate("/");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-sky-100/40 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <Link to="/" className="text-sm font-semibold text-primary">
          Aló Clínica
        </Link>
        <button
          type="button"
          onClick={skip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Pular
        </button>
      </header>

      <section className="flex-1 flex items-center justify-center px-4 py-6 md:py-10">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="relative flex items-center justify-center order-2 lg:order-1">
            <div className="absolute inset-0 bg-sky-200/40 blur-3xl rounded-full" aria-hidden />
            <AnimatePresence mode="wait">
              <motion.img
                key={step.image}
                src={step.image}
                alt={step.alt}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.96 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="relative w-64 md:w-80 lg:w-[22rem] drop-shadow-xl"
                loading="eager"
              />
            </AnimatePresence>
          </div>

          <div className="order-1 lg:order-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold mb-4">
                  <Icon className="w-3.5 h-3.5" />
                  Passo {index + 1} de {steps.length}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight font-display">
                  {step.title}
                </h1>
                <p className="mt-3 text-base md:text-lg text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {step.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-sm md:text-base text-foreground/90">
                      <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex items-center gap-2" role="tablist" aria-label="Progresso do onboarding">
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ir para o passo ${i + 1}`}
                  aria-selected={i === index}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-8 bg-primary" : "w-4 bg-primary/25 hover:bg-primary/40"
                  }`}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {index > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  className="sm:w-auto"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
              )}
              {!isLast ? (
                <Button onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))} className="sm:flex-1">
                  Próximo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={finish} className="sm:flex-1">
                  Agendar minha consulta
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="px-6 py-4 text-center text-xs text-muted-foreground">
        Já conhece a plataforma?{" "}
        <Link to="/paciente" className="text-primary font-semibold hover:underline">
          Entrar na minha conta
        </Link>
      </footer>
    </main>
  );
}
