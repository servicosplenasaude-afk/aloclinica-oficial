import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { memo, forwardRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { usePrefetchRoute } from "@/hooks/use-prefetch-route";
import OptimizedImage from "@/components/ui/optimized-image";
import { ArrowRight, ShieldCheck, Clock, Users, Video, FileText, BadgeCheck } from "lucide-react";
import heroPingoFamily from "@/assets/hero-pingo-family.webp";

const highlights = [
  { icon: FileText, text: "Receita digital", sub: "válida em todo o Brasil" },
  { icon: Clock, text: "Atendimento 24h", sub: "— inclusive feriados" },
  { icon: Users, text: "30+", sub: "especialidades médicas" },
];


const complianceLogos = ["CFM", "ICP-Brasil", "LGPD", "ISO 27001"];

// Brilhos que flutuam ao redor do Pingo (posição, tamanho e ritmo próprios).
const SPARKLES = [
  { top: "10%", left: "18%", size: 8, dur: 4.2, delay: 0 },
  { top: "22%", left: "84%", size: 6, dur: 5.1, delay: 0.6 },
  { top: "66%", left: "8%", size: 7, dur: 4.8, delay: 1.1 },
  { top: "80%", left: "82%", size: 5, dur: 5.6, delay: 0.3 },
  { top: "44%", left: "92%", size: 5, dur: 6.0, delay: 0.9 },
];

const HeroSection = memo(
  forwardRef<HTMLElement, { config?: any }>(({ config }, ref) => {
    const navigate = useNavigate();
    const prefetchPaciente = usePrefetchRoute(() => import("@/pages/AuthPaciente"));

    // Parallax suave: o Pingo se inclina de leve seguindo o cursor. Desligado
    // para quem prefere menos movimento (prefers-reduced-motion) e no toque.
    const reduce = useReducedMotion();
    const px = useMotionValue(0);
    const py = useMotionValue(0);
    const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), { stiffness: 120, damping: 14 });
    const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 14 });
    const handlePointer = (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduce) return;
      const r = e.currentTarget.getBoundingClientRect();
      px.set((e.clientX - r.left) / r.width - 0.5);
      py.set((e.clientY - r.top) / r.height - 0.5);
    };
    const resetPointer = () => { px.set(0); py.set(0); };

    const rawTitle: string = config?.title || "Cuidado médico de excelência";
    const words = rawTitle.trim().split(/\s+/);
    const fallbackAccent = words.length > 2 ? words.slice(-2).join(" ") : "";
    const titleAccent = config?.title_highlight || fallbackAccent;
    const titleMain = config?.title_highlight
      ? rawTitle
      : words.slice(0, Math.max(1, words.length - 2)).join(" ");
    const subtitle =
      config?.subtitle ||
      "Conecte-se a médicos especialistas verificados pelo CFM. Consultas por vídeo em HD, receitas digitais válidas e prontuário eletrônico completo.";
    const ctaText = config?.cta_text || "Agendar consulta";
    const ctaUrl = config?.cta_url || "/agendar";
    const badgeText = config?.badge_text || "Médicos verificados no CFM";

    return (
      <section
        ref={ref}
        aria-label="Início"
        className="relative pt-24 sm:pt-28 lg:pt-32 pb-10 sm:pb-14 lg:pb-16 overflow-hidden bg-gradient-to-br from-[#f6fbff] via-white to-[#eef6ff]"
      >
        {/* Ambient depth: micro dot-grid texture + soft color glows */}
        <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 hero-texture" />
          <div className="absolute top-[-10%] right-[5%] w-[540px] h-[540px] rounded-full bg-[#0ea5e9]/[0.10] blur-[130px]" />
          <div className="absolute bottom-[-8%] left-[-6%] w-[440px] h-[440px] rounded-full bg-[#1667e6]/[0.07] blur-[130px]" />
        </div>

        <div className="w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-8 items-center">
            {/* Left content */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col justify-center min-w-0"
            >
              <div className="inline-flex items-center gap-2 pl-2.5 pr-4 py-2 bg-white text-slate-700 rounded-full text-xs sm:text-sm font-semibold mb-7 border border-slate-200/70 shadow-[0_6px_20px_-10px_rgba(15,23,42,0.25)] w-fit">
                <ShieldCheck className="w-4 h-4 text-emerald-600" strokeWidth={2.4} />
                {badgeText}
              </div>

              <h1 className="font-display text-[clamp(2.15rem,4.6vw,3.6rem)] font-extrabold leading-[1.04] mb-6 tracking-[-0.042em] text-balance">
                <span className="text-[#0b1b34]">{titleMain}</span>
                {titleAccent && (
                  <>
                    <br />
                    <span className="text-hero-accent">{titleAccent}</span>
                  </>
                )}
              </h1>

              <p className="text-base sm:text-lg text-[#54627a] max-w-[520px] mb-8 leading-relaxed">{subtitle}</p>

              {/* CTA + inline signals */}
              <div className="flex flex-wrap items-center gap-x-7 gap-y-4 mb-7">
                <Button
                  size="lg"
                  onClick={() => navigate(ctaUrl)}
                  onMouseEnter={prefetchPaciente}
                  className="rounded-2xl h-[58px] px-8 text-base font-bold bg-gradient-to-r from-[#1667e6] to-[#0b4fc4] hover:from-[#0b4fc4] hover:to-[#093f9e] text-white shadow-[0_16px_34px_-12px_rgba(22,103,230,0.6)] transition-all duration-300 hover:-translate-y-0.5 group"
                >
                  {ctaText}
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>

                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-[13px] font-bold text-slate-800">Médicos verificados</p>
                    <span className="text-[12px] text-slate-500">no CFM</span>
                  </div>
                </div>

              </div>


            </motion.div>

            {/* Right area — cena animada do Pingo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
              onMouseMove={handlePointer}
              onMouseLeave={resetPointer}
              className="relative flex items-center justify-center min-w-0 [perspective:1100px]"
            >
              {/* Halo em degradê que "respira" */}
              <motion.div
                aria-hidden
                animate={reduce ? undefined : { scale: [1, 1.055, 1], opacity: [0.82, 1, 0.82] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[2%] w-[82%] aspect-square rounded-full bg-gradient-to-br from-[#eaf4ff] to-[#d9e9ff] -z-10"
              />
              {/* Anel suave fixo */}
              <div aria-hidden className="absolute top-0 w-[88%] aspect-square rounded-full border-[14px] border-[#dbeafe] pointer-events-none" />
              {/* Anel tracejado girando devagar */}
              <motion.div
                aria-hidden
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 52, repeat: Infinity, ease: "linear" }}
                className="absolute top-[-2%] w-[94%] aspect-square rounded-full border-2 border-dashed border-[#a9cdff]/60 pointer-events-none"
              />

              {/* Brilhos flutuantes */}
              {!reduce && SPARKLES.map((s, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute rounded-full bg-white z-20 shadow-[0_0_12px_2px_rgba(88,150,255,0.55)]"
                  style={{ width: s.size, height: s.size, top: s.top, left: s.left }}
                  animate={{ y: [0, -14, 0], opacity: [0.2, 1, 0.2], scale: [0.8, 1.15, 0.8] }}
                  transition={{ duration: s.dur, repeat: Infinity, ease: "easeInOut", delay: s.delay }}
                />
              ))}

              {/* Pingo — inclina no cursor (parallax) + flutua + respira */}
              <motion.div
                style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
                className="relative z-10 w-full max-w-[580px]"
              >
                <motion.div
                  animate={reduce ? undefined : { y: [0, -12, 0] }}
                  transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <OptimizedImage
                    src={heroPingoFamily}
                    alt="Pingo, mascote da AloClínica, junto a pacientes de todas as idades"
                    priority
                    className="w-full h-auto object-contain drop-shadow-2xl"
                  />
                </motion.div>
              </motion.div>

              {/* Cartão flutuante — Teleconsulta (topo) */}
              <motion.div
                initial={{ opacity: 0, x: 20, y: -6 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="absolute -top-2 right-0 sm:right-2 z-20"
              >
                <motion.div
                  animate={reduce ? undefined : { y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.4)] flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#1667e6] flex items-center justify-center">
                    <Video className="w-5 h-5 text-white" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">Teleconsulta</p>
                    <p className="text-sm font-bold text-[#0b1b34]">Vídeo em HD</p>
                  </div>
                </motion.div>
              </motion.div>

              {/* Cartão flutuante — Receita digital (base) */}
              <motion.div
                initial={{ opacity: 0, x: -20, y: 6 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.85, duration: 0.5 }}
                className="absolute bottom-3 left-0 sm:-left-2 z-20"
              >
                <motion.div
                  animate={reduce ? undefined : { y: [0, 9, 0] }}
                  transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                  className="bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.4)] flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">Receita</p>
                    <p className="text-sm font-bold text-[#0b1b34]">Digital válida</p>
                  </div>
                </motion.div>
              </motion.div>

            </motion.div>
          </div>

          {/* Unified trust band — highlights + security card aligned */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-6 lg:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5"
          >
            {/* White highlights card */}
            <div className="rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-100 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.25)] p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:divide-x sm:divide-slate-100">
                {highlights.map(({ icon: Icon, text, sub }) => (
                  <div key={text} className="flex items-center gap-3 sm:px-3 sm:first:pl-0 sm:last:pr-0 min-w-0">
                    <div className="w-11 h-11 shrink-0 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1667e6]">
                      <Icon className="w-5 h-5" strokeWidth={2.2} />
                    </div>
                    <div className="leading-tight min-w-0">
                    <p className="text-sm font-bold text-slate-900 whitespace-nowrap">{text}</p>
                      <p className="text-xs text-slate-500">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security card */}
            <div className="rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-100 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.25)] p-4 sm:p-5 flex items-center gap-4">
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-emerald-600" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-[#0b1b34] mb-1">Consulta segura</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Médicos com CRM ativo, vídeo criptografado e receita digital com assinatura ICP-Brasil.
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-center justify-center shrink-0 px-2 text-emerald-700">
                <span className="text-[13px] font-extrabold leading-none">ICP</span>
                <span className="text-[13px] font-extrabold leading-tight">Brasil</span>
              </div>
            </div>
          </motion.div>

          {/* Compliance strip — chips estruturados (antes: texto cinza chapado) */}
          <div className="mt-12 lg:mt-14">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400 mb-5">
              Confiança de quem cuida
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              {complianceLogos.map((logo) => (
                <li key={logo} className="compliance-chip">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2.4} aria-hidden />
                  {logo}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  })
);

HeroSection.displayName = "HeroSection";
export default HeroSection;
