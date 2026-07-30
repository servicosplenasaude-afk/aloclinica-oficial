import { forwardRef } from "react";
import { BannerCTA } from "@/components/ui/banner-cta";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Clock, Star, Check, Heart, Lightning } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import mascotThumbsup from "@/assets/mascot-thumbsup.png";

const platformFacts = [
  "Atendimento por vídeo, 24h por dia",
  "Receita digital válida em todo o Brasil",
  "Atestado digital",
  "Médicos verificados no CFM",
  "Dados criptografados e sigilosos",
];

const benefits = [
  { icon: Lightning, text: "Consulta em minutos" },
  { icon: ShieldCheck, text: "Dados criptografados" },
  { icon: Clock, text: "Disponível 24/7" },
  { icon: Star, text: "Receita digital válida" },
  { icon: Heart, text: "30+ especialidades" },
];

const CTABanner = forwardRef<HTMLElement, { config?: any }>(({ config }, ref) => {
  const navigate = useNavigate();

  const badge          = config?.badge || "Atendimento por vídeo, 24h";
  const title          = config?.title || "Comece a cuidar da sua saúde";
  const titleHighlight = config?.title_highlight || "hoje mesmo";
  const subtitle       = config?.subtitle || "Cadastre-se gratuitamente e agende sua primeira consulta com um especialista em minutos.";
  const ctaText        = config?.cta_text || "Criar minha conta";
  const ctaUrl         = config?.cta_url || "/paciente";
  const ctaSecondary   = config?.cta_secondary_text || "Consulta avulsa";
  const facts: string[] = Array.isArray(config?.facts) && config.facts.length
    ? config.facts.map((f: any) => (typeof f === "string" ? f : f?.text)).filter(Boolean)
    : platformFacts;

  return (
    <section className="py-16 md:py-28 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary via-primary/95 to-secondary shadow-2xl shadow-primary/20"
        >
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/[0.04] -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-white/[0.04] translate-y-1/3 -translate-x-1/4" />
          <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] rounded-full bg-white/[0.015]" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 gap-0">
            {/* Left column — CTA content */}
            <div className="lg:col-span-3 p-8 md:p-12 lg:px-16 lg:py-14 flex flex-col justify-center">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground text-xs font-semibold w-fit mb-6"
              >
                <Clock className="w-3 h-3" weight="fill" />
                {badge}
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-primary-foreground leading-[1.1] mb-5 tracking-tight"
              >
                {title}{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">{titleHighlight}</span>
                  <span className="absolute bottom-1 left-0 right-0 h-3.5 bg-white/15 rounded-full -z-0" />
                </span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="text-primary-foreground/70 text-base md:text-lg max-w-lg mb-8 leading-relaxed text-pretty"
              >
                {subtitle}
              </motion.p>

              {/* Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-wrap gap-3 mb-10"
              >
                <Button
                  variant="rainbow"
                  size="lg"
                  className="rounded-full px-8 font-bold shadow-xl shadow-black/10 hover:shadow-2xl transition-all hover:scale-[1.03] active:scale-[0.97] group h-12"
                  onClick={() => navigate(ctaUrl)}
                >
                  {ctaText}
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" weight="bold" />
                </Button>
                <BannerCTA
                  tone="light"
                  size="lg"
                  onClick={() => navigate("/paciente")}
                >
                  {ctaSecondary}
                </BannerCTA>
              </motion.div>

              {/* Benefits row */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex flex-wrap gap-x-5 gap-y-2.5"
              >
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-primary-foreground/60 text-[11px] font-medium">
                    <b.icon className="w-3.5 h-3.5" weight="fill" />
                    {b.text}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right column — comparison + mascot */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center p-6 md:p-8 lg:p-10">
              {/* Mascot */}
              <motion.img
                src={mascotThumbsup}
                alt="Pingo mascote"
                className="w-28 h-28 md:w-32 md:h-32 object-contain drop-shadow-2xl mb-5 hidden lg:block"
                initial={{ opacity: 0, y: -20, rotate: -8 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.35, type: "spring", stiffness: 180, damping: 14 }}
                whileHover={{ rotate: 5, scale: 1.08, transition: { duration: 0.3 } }}
              />

              {/* Benefits card */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-sm rounded-2xl bg-white/[0.1] backdrop-blur-lg border border-white/[0.12] overflow-hidden shadow-xl shadow-black/10"
              >
                <div className="text-[10px] uppercase tracking-widest font-bold px-5 py-3.5 border-b border-white/10 text-primary-foreground">
                  Por que a AloClínica
                </div>
                {facts.map((fact, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 text-[12px] text-primary-foreground/75 px-5 py-3 ${
                      i < facts.length - 1 ? "border-b border-white/[0.06]" : ""
                    } hover:bg-white/[0.04] transition-colors`}
                  >
                    <span className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-medical-green/25">
                      <Check className="w-3.5 h-3.5 text-medical-green" weight="bold" />
                    </span>
                    <span className="font-medium text-primary-foreground/85">{fact}</span>
                  </div>
                ))}
              </motion.div>

              {/* Trust note */}
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.55, duration: 0.5 }}
                className="text-[10px] text-primary-foreground/35 mt-4 text-center italic"
              >
                Médicos verificados no CFM · Receita digital válida em todo o Brasil
              </motion.p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
});
CTABanner.displayName = "CTABanner";
export default CTABanner;
