import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { memo, forwardRef } from "react";
import { motion } from "framer-motion";
import { usePrefetchRoute } from "@/hooks/use-prefetch-route";
import OptimizedImage from "@/components/ui/optimized-image";
import { ArrowRight, ShieldCheck, Clock, Users, Lock, BadgeCheck, Video, FileText, MapPin } from "lucide-react";
import heroPingoFamily from "@/assets/hero-pingo-family.png";

const highlights = [
  { icon: FileText, text: "Receita digital", sub: "válida em todo o Brasil" },
  { icon: Clock, text: "Atendimento 24h", sub: "— inclusive feriados" },
  { icon: Users, text: "30+", sub: "especialidades médicas" },
];

const trustStats = [
  { icon: ShieldCheck, value: "CFM", label: "Médicos verificados" },
  { icon: Lock, value: "Segurança", label: "Seus dados protegidos com criptografia" },
  { icon: BadgeCheck, value: "LGPD", label: "Privacidade em conformidade" },
];

const complianceLogos = ["CFM", "ICP-Brasil", "LGPD", "ISO 27001"];

const HeroSection = memo(
  forwardRef<HTMLElement, { config?: any }>(({ config }, ref) => {
    const navigate = useNavigate();
    const prefetchPaciente = usePrefetchRoute(() => import("@/pages/AuthPaciente"));

    const titleMain = config?.title || "Cuidado médico";
    const titleAccent = config?.title_highlight || "de excelência";
    const subtitle = config?.subtitle || "Conecte-se a médicos especialistas verificados pelo CFM. Consultas por vídeo em HD, receitas digitais válidas e prontuário eletrônico completo.";
    const ctaText = config?.cta_text || "Agendar consulta";
    const ctaUrl = config?.cta_url || "/agendar";
    const badgeText = config?.badge_text || "Médicos verificados no CFM";

    return (
      <section
        ref={ref}
        aria-label="Início"
        className="relative pt-24 sm:pt-28 lg:pt-32 pb-8 sm:pb-12 lg:pb-16 overflow-hidden bg-white"
      >
        {/* Ambient glows */}
        <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[5%] w-[520px] h-[520px] rounded-full bg-[#0ea5e9]/[0.10] blur-[120px]" />
          <div className="absolute bottom-[-5%] left-[-5%] w-[420px] h-[420px] rounded-full bg-[#0284c7]/[0.08] blur-[120px]" />
        </div>

        <div className="w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left content */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col justify-center pt-2 lg:pt-8"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold mb-6 border border-emerald-200/60 w-fit">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                {badgeText}
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold leading-[1.05] mb-5 tracking-[-0.02em]">
                <span className="text-[#0f172a]">{titleMain}</span>
                <br />
                <span className="text-[#0ea5e9]">{titleAccent}</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-lg mb-8 leading-relaxed">
                {subtitle}
              </p>

              {/* Highlights */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-8">
                {highlights.map(({ icon: Icon, text, sub }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                      <Icon className="w-5 h-5" strokeWidth={2.2} />
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-bold text-slate-900">{text}</p>
                      <p className="text-xs text-slate-500 font-medium">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex flex-wrap items-center gap-4 mb-8">
                <Button
                  size="lg"
                  onClick={() => navigate(ctaUrl)}
                  onMouseEnter={prefetchPaciente}
                  className="rounded-2xl h-[56px] px-8 text-base font-bold bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] hover:from-[#0284c7] hover:to-[#0369a1] text-white shadow-[0_12px_30px_-8px_rgba(2,132,199,0.45)] transition-all duration-300 hover:-translate-y-0.5 group"
                >
                  {ctaText}
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>

                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 rounded-full border border-emerald-100">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-[13px] font-bold text-slate-800">Médicos verificados no CFM</p>
                    <span className="text-[11px] text-slate-500 font-medium">Receita digital válida em todo o Brasil</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right image area */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
              className="relative flex items-center justify-center"
            >
              {/* Circular blue ring */}
              <div className="absolute w-[90%] aspect-square rounded-full border-[12px] border-[#e0f2fe] pointer-events-none" />
              <div className="absolute w-[82%] aspect-square rounded-full bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] -z-10" />

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10 w-full max-w-[520px]"
              >
                <OptimizedImage
                  src={heroPingoFamily}
                  alt="Pingo, mascote da AloClínica, junto a pacientes de todas as idades"
                  priority
                  className="w-full h-auto object-contain drop-shadow-2xl"
                />
              </motion.div>

              {/* Floating video badge */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="absolute top-6 right-2 sm:right-6 z-20"
              >
                <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-100 shadow-lg flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Video className="w-5 h-5 text-[#0ea5e9]" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Teleconsulta</p>
                    <p className="text-sm font-bold text-slate-800">Vídeo em HD</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Bottom cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10 lg:mt-14">
            {/* Blue trust card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-gradient-to-r from-[#0b63f6] to-[#2563eb] rounded-3xl p-5 sm:p-6 text-white shadow-[0_20px_50px_-12px_rgba(11,99,246,0.35)]"
            >
              <div className="grid grid-cols-3 gap-4 divide-x divide-white/20">
                {trustStats.map(({ icon: Icon, value, label }) => (
                  <div key={label} className="flex flex-col items-center text-center px-2 first:pl-0 last:pr-0">
                    <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center mb-2 backdrop-blur-sm">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm sm:text-base font-bold leading-tight">{value}</p>
                    <p className="text-[10px] sm:text-xs text-white/80 leading-tight mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* White security card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_12px_40px_-16px_rgba(2,132,199,0.18)] flex flex-col sm:flex-row items-start sm:items-center gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-900">Consulta segura</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Médicos com CRM ativo, vídeo criptografado e receita digital com assinatura ICP-Brasil.
                </p>
              </div>
              <div className="flex items-center gap-3 sm:ml-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  Criptografia de ponta
                </span>
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <Award className="w-5 h-5" />
                  <span className="text-xs font-bold">ICP-Brasil</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    );
  })
);

HeroSection.displayName = "HeroSection";
export default HeroSection;
