import { forwardRef, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
import { motion } from "framer-motion";
import { UserPlus, MagnifyingGlass, VideoCamera, FileText, Clock } from "@phosphor-icons/react";
import { useSiteConfig } from "@/lib/site-config";
import stepSignupAsset from "@/assets/step-cadastro.png.asset.json";
import stepSearchAsset from "@/assets/step-agenda.png.asset.json";
import stepVideocallAsset from "@/assets/step-videochamada.png.asset.json";
import stepPrescriptionAsset from "@/assets/step-receita.png.asset.json";

const stepSignup = stepSignupAsset.url;
const stepSearch = stepSearchAsset.url;
const stepVideocall = stepVideocallAsset.url;
const stepPrescription = stepPrescriptionAsset.url;

const steps = [
  { icon: UserPlus, title: "Cadastre-se", description: "Crie sua conta em menos de 2 minutos.", image: stepSignup, time: "2 min", accent: "from-primary/20 to-secondary/10" },
  { icon: MagnifyingGlass, title: "Encontre seu médico", description: "Busque por especialidade ou disponibilidade.", image: stepSearch, time: "1 min", accent: "from-secondary/20 to-success/10" },
  { icon: VideoCamera, title: "Consulta por vídeo", description: "Videochamada segura e em HD.", image: stepVideocall, time: "15-30 min", accent: "from-blue-500/15 to-primary/10" },
  { icon: FileText, title: "Receba sua receita", description: "Receita digital válida na hora.", image: stepPrescription, time: "Instantâneo", accent: "from-success/20 to-emerald-400/10" },
];

const DEFAULT_ICONS = [UserPlus, MagnifyingGlass, VideoCamera, FileText];
const DEFAULT_IMAGES = [stepSignup, stepSearch, stepVideocall, stepPrescription];
const DEFAULT_ACCENTS = [
  "from-primary/20 to-secondary/10",
  "from-secondary/20 to-success/10",
  "from-blue-500/15 to-primary/10",
  "from-success/20 to-emerald-400/10",
];

/* Paleta Pingo por passo — cada etapa ganha sua própria cor */
const STEP_HUES = [
  { hue: "var(--pingo-sky)",   label: "azul-gelo" },
  { hue: "var(--pingo-mint)",  label: "menta" },
  { hue: "var(--pingo-grape)", label: "uva" },
  { hue: "var(--pingo-sun)",   label: "sol" },
];

const HowItWorksSection = forwardRef<HTMLElement>((_, ref) => {
  const stepsRef = useRef<HTMLDivElement>(null);
  const { get } = useSiteConfig();
  const title = get("how_it_works_title", "Como funciona");
  const desc  = get("how_it_works_desc",  "Em 4 passos simples, acesse médicos especialistas sem sair de casa.");

  // Parse CMS steps, fall back to hard-coded defaults
  let cmsSteps: Array<{ title: string; desc: string; time?: string }> | null = null;
  try {
    const raw = get("how_it_works_steps", "");
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length > 0) cmsSteps = p;
    }
  } catch { /* use defaults */ }

  const effectiveSteps = (cmsSteps ?? steps.map((s, i) => ({ title: s.title, desc: s.description, time: s.time }))).map((s, i) => ({
    icon: DEFAULT_ICONS[i % DEFAULT_ICONS.length],
    image: DEFAULT_IMAGES[i % DEFAULT_IMAGES.length],
    accent: DEFAULT_ACCENTS[i % DEFAULT_ACCENTS.length],
    title: s.title,
    description: s.desc,
    time: s.time ?? "",
  }));

  useEffect(() => {
    const el = stepsRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const cards = el.querySelectorAll(".step-card");
      ScrollTrigger.create({
        trigger: el, start: "top 80%", once: true,
        onEnter: () => gsap.fromTo(cards,
          { opacity: 0, y: 28, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, stagger: 0.1, duration: 0.55, ease: "power3.out", clearProps: "transform,opacity" }
        ),
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section id="como-funciona" className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/[0.06] border border-primary/10 text-primary text-sm font-semibold mb-4">
            <Clock className="w-3.5 h-3.5" weight="fill" />
            Em poucos minutos
          </span>
          <h2 className="text-2xl md:text-4xl font-extrabold mb-3 tracking-tight text-gradient-pingo">
            {title}
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            {desc}
          </p>
        </motion.div>

        {/* Desktop: premium mascot-forward cards */}
        <div className="hidden lg:block relative">
          <div ref={stepsRef} className="grid lg:grid-cols-4 gap-8 relative pt-6">
            {effectiveSteps.map((step, i) => {
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="step-card group relative"
                >
                  <div
                    className="relative flex flex-col bg-card rounded-[2rem] p-6 shadow-xl border border-border/50 transition-all duration-500 hover:-translate-y-2 h-full ring-pingo sheen-pingo"
                    style={{ boxShadow: `0 18px 45px -24px hsl(${STEP_HUES[i % 4].hue} / 0.55)` }}
                  >
                    {/* Floating step number badge */}
                    <div
                      className="absolute -top-4 -left-4 w-12 h-12 flex items-center justify-center text-white rounded-2xl font-extrabold text-base shadow-lg z-20 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                      style={{
                        background: `linear-gradient(135deg, hsl(${STEP_HUES[i % 4].hue}), hsl(var(--pingo-blue)))`,
                        boxShadow: `0 10px 24px -10px hsl(${STEP_HUES[i % 4].hue} / 0.8)`,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>

                    {/* Mascot image area */}
                    <div className="relative aspect-square mb-6">
                      <div
                        className="absolute inset-0 rounded-2xl scale-95 opacity-70 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500"
                        style={{ background: `radial-gradient(circle at 50% 65%, hsl(${STEP_HUES[i % 4].hue} / 0.20), transparent 70%)` }}
                      />
                      <img
                        src={step.image}
                        alt={step.title}
                        loading="lazy"
                        decoding="async"
                        className="relative z-10 w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-500 animate-pingo-float"
                        style={{ animationDelay: `${i * 0.6}s` }}
                      />
                      {/* Time badge */}
                      <span className="absolute top-2 right-2 flex items-center gap-1 px-3 py-1 bg-card/80 backdrop-blur-md rounded-lg text-[10px] font-bold text-muted-foreground shadow-sm border border-border/40 z-20">
                        <Clock className="w-2.5 h-2.5" weight="fill" />
                        {step.time}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110"
                        style={{ background: `hsl(${STEP_HUES[i % 4].hue} / 0.14)`, color: `hsl(${STEP_HUES[i % 4].hue})` }}
                      >
                        <step.icon className="w-5 h-5" weight="fill" />
                      </div>
                      <h3 className="text-xl font-bold text-primary tracking-tight">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="lg:hidden relative">
          <motion.div
            className="absolute left-6 top-0 bottom-0 w-px bg-border/60"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ originY: 0 }}
          />

          <div className="space-y-5">
            {effectiveSteps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="relative flex gap-4 pl-2"
              >
                <motion.div
                  className="relative z-10 w-12 h-12 rounded-xl border flex items-center justify-center shrink-0"
                  style={{
                    background: `hsl(${STEP_HUES[i % 4].hue} / 0.12)`,
                    borderColor: `hsl(${STEP_HUES[i % 4].hue} / 0.28)`,
                  }}
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 + 0.1, type: "spring", stiffness: 300 }}
                >
                  <span className="text-sm font-extrabold" style={{ color: `hsl(${STEP_HUES[i % 4].hue})` }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </motion.div>

                <div className="flex-1 bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
                  {/* Mobile image */}
                  <div className="relative w-full h-28 overflow-hidden">
                    <img src={step.image} alt={step.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    <div className={`absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent`} />
                  </div>
                  <div className="p-4 -mt-4 relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <step.icon className="w-3.5 h-3.5 text-primary" weight="fill" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        <Clock className="w-2.5 h-2.5" weight="fill" />
                        {step.time}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4 mt-12 text-sm text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" weight="fill" />
            <strong className="text-foreground">Em poucos minutos</strong> do cadastro à receita
          </span>
          <span className="hidden sm:inline text-border">•</span>
          <span>Totalmente online</span>
          <span className="hidden sm:inline text-border">•</span>
          <span>Sem necessidade de download</span>
        </motion.div>
      </div>
    </section>
  );
});
HowItWorksSection.displayName = "HowItWorksSection";
export default HowItWorksSection;
