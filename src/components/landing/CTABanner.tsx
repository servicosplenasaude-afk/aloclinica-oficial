import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ctaBannerAsset from "@/assets/visual-system/pingo-cta-agendamento.webp";

const CTABanner = forwardRef<HTMLElement, { config?: any }>(({ config }, ref) => {
  const navigate = useNavigate();

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
          className="relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] border border-[hsl(var(--pingo-sky)/0.25)] bg-white shadow-[0_30px_70px_-40px_rgba(15,23,42,0.45)]"
        >
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-white via-white/95 to-transparent lg:via-white/75" />
          <div className="absolute inset-y-0 left-0 z-20 flex max-w-[720px] flex-col justify-center px-7 py-10 md:px-12 lg:px-14">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-primary">Atendimento digital</p>
            <h2 className="text-3xl font-black leading-tight text-foreground md:text-5xl">Sua consulta, onde você estiver</h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">Escolha um especialista verificado, converse por vídeo e receba seus documentos digitais com segurança.</p>
          </div>
          <img
            src={ctaBannerAsset}
            alt="Pingo ao lado de um celular com médico em videochamada: consulta online com mais agilidade e cuidado"
            className="h-[420px] w-full object-cover object-[75%_center]"
            width={768}
            height={768}
            loading="lazy"
          />

          {/* CTA bar */}
          <div className="relative z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 md:px-10 py-5 md:py-6 bg-gradient-to-r from-[hsl(var(--pingo-ice)/0.5)] to-white border-t border-[hsl(var(--pingo-sky)/0.2)]">
            <div className="flex items-center gap-3">
              <span className="inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600">
                <ShieldCheck className="w-5 h-5" strokeWidth={2.2} />
              </span>
              <div className="leading-tight">
                <p className="text-sm md:text-base font-bold text-foreground">Médicos verificados no CFM</p>
                <p className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Receita digital válida
                </p>
              </div>
            </div>

            <Button
              size="lg"
              className="rounded-full px-8 h-12 font-bold w-fit group shadow-[0_16px_34px_-16px_hsl(var(--pingo-blue)/0.8)] transition-all hover:scale-[1.03] active:scale-[0.97]"
              onClick={() => navigate(ctaUrl)}
            >
              {ctaText}
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
});

CTABanner.displayName = "CTABanner";
export default CTABanner;
