import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Heart, CalendarClock, ShieldCheck, Clock, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ctaBannerMascot from "@/assets/cta-banner-mascot.png";

const BADGES = [
  { icon: FileText, label: "Receita digital" },
  { icon: Heart, label: "30+ especialidades" },
  { icon: CalendarClock, label: "Agendamento rápido" },
  { icon: ShieldCheck, label: "Atendimento seguro" },
  { icon: Clock, label: "Consulta 24h" },
  { icon: Video, label: "Por vídeo" },
];

const CTABanner = forwardRef<HTMLElement, { config?: any }>(({ config }, ref) => {
  const navigate = useNavigate();

  const badge = config?.badge || "Na palma da sua mão";
  const title = config?.title || "Agende sua consulta em";
  const titleHighlight = config?.title_highlight || "menos de 2 minutos";
  const ctaText = config?.cta_text || "Agendar agora";
  const ctaUrl = config?.cta_url || "/paciente";

  return (
    <section ref={ref} className="py-12 md:py-20 px-4">
      <div className="container mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-br from-[#0a1f4a] via-[#0d3a8a] to-[#1259a7] shadow-2xl shadow-primary/20"
        >
          {/* Dotted texture overlay */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.25) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          {/* Soft glow accents */}
          <div className="absolute top-0 right-1/3 w-[420px] h-[420px] rounded-full bg-white/[0.04] -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-secondary/[0.08] translate-y-1/3 -translate-x-1/4" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1f4a]/80 via-transparent to-[#1259a7]/40" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left column — copy */}
            <div className="p-8 md:p-12 lg:px-14 lg:py-12 flex flex-col justify-center">
              {/* Top badge */}
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm text-white text-[10px] md:text-xs font-extrabold uppercase tracking-[0.2em] w-fit mb-6"
              >
                {badge}
              </motion.div>

              {/* Headline */}
              <motion.h2
                initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-3xl md:text-4xl lg:text-[2.75rem] font-extrabold text-white leading-[1.1] mb-6 tracking-tight"
              >
                {title}{" "}
                <span className="text-[hsl(168,65%,55%)]">{titleHighlight}</span>
              </motion.h2>

              {/* CTA + trust line */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
              >
                <Button
                  size="lg"
                  className="rounded-full px-8 font-bold bg-white text-[#0a1f4a] hover:bg-white/90 shadow-xl shadow-black/10 hover:shadow-2xl transition-all hover:scale-[1.03] active:scale-[0.97] group h-12 w-fit"
                  onClick={() => navigate(ctaUrl)}
                >
                  {ctaText}
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
                </Button>

                <div className="flex flex-col gap-0.5">
                  <span className="text-white font-bold text-sm md:text-base flex items-center gap-2">
                    Médicos verificados no CFM
                  </span>
                  <span className="text-white/60 text-[10px] md:text-xs font-semibold uppercase tracking-wider">
                    Receita digital válida
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Right column — mascot */}
            <div className="relative hidden lg:flex items-end justify-center lg:justify-end p-6 lg:pr-10 lg:pb-0">
              <motion.img
                src={ctaBannerMascot}
                alt="Pingo mascote ao lado de um celular mostrando médico em videochamada"
                className="relative z-10 w-full max-w-[460px] object-contain object-bottom drop-shadow-2xl"
                width={520}
                height={390}
                loading="lazy"
                initial={{ opacity: 0, x: 30, scale: 0.96 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
              {/* Mobile fallback image */}
            </div>
          </div>

          {/* Mobile mascot image */}
          <div className="lg:hidden relative px-6 -mt-4 mb-4 flex justify-center">
            <motion.img
              src={ctaBannerMascot}
              alt="Pingo mascote ao lado de um celular mostrando médico em videochamada"
              className="w-full max-w-md object-contain drop-shadow-2xl"
              width={400}
              height={300}
              loading="lazy"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
            />
          </div>

          {/* Bottom horizontal badge strip */}
          <div className="relative z-20 border-t border-white/10 bg-[#0a1f4a]/60 backdrop-blur-md">
            <div className="px-4 md:px-6 py-3 md:py-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.45, duration: 0.5 }}
                className="flex flex-nowrap items-center justify-between gap-1 md:gap-2 overflow-x-auto"
              >
                {BADGES.map((item, i) => {
                  const Icon = item.icon;
                  const colors = [
                    "text-emerald-300 ring-emerald-300/30",
                    "text-amber-300 ring-amber-300/30",
                    "text-sky-300 ring-sky-300/30",
                    "text-rose-300 ring-rose-300/30",
                    "text-teal-300 ring-teal-300/30",
                    "text-cyan-300 ring-cyan-300/30",
                  ];
                  const color = colors[i % colors.length];
                  return (
                    <div
                      key={i}
                      className="group inline-flex items-center justify-center gap-1.5 shrink-0 pl-1.5 pr-1.5 md:pl-2 md:pr-2 py-1.5 md:py-2 rounded-full bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] hover:border-white/20 transition-colors"
                    >
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10 ring-1 ${color}`}>
                        <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
                      </span>
                      <span className="text-white/90 font-bold text-[8px] md:text-[9px] uppercase tracking-wider whitespace-nowrap">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
});

CTABanner.displayName = "CTABanner";
export default CTABanner;
