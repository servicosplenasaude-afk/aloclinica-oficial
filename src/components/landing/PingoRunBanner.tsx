import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import bannerAsset from "@/assets/banner-consulta-online-pingo.png.asset.json";

/** Faixa clara com a arte oficial do Pingo em consulta online. */
const PingoRunBanner = () => {
  const navigate = useNavigate();

  return (
    <section
      aria-label="Consulta online com mais agilidade e cuidado"
      className="relative w-full px-4 sm:px-6 lg:px-8 py-6 md:py-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] md:rounded-[2.5rem] border border-[hsl(var(--pingo-sky)/0.25)] bg-white shadow-[0_30px_70px_-40px_rgba(15,23,42,0.45)]"
      >
        <img
          src={bannerAsset.url}
          alt="Pingo ao lado de um celular com médico em videochamada: consulta online com mais agilidade e cuidado"
          className="w-full h-auto object-cover"
          width={1920}
          height={624}
          loading="lazy"
          decoding="async"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 md:px-10 py-5 md:py-6 bg-gradient-to-r from-[hsl(var(--pingo-ice)/0.5)] to-white border-t border-[hsl(var(--pingo-sky)/0.2)]">
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

          <button
            type="button"
            onClick={() => navigate("/agendar")}
            className="group inline-flex items-center gap-2 rounded-full px-8 h-12 font-bold text-primary-foreground bg-primary w-fit shadow-[0_16px_34px_-16px_hsl(var(--pingo-blue)/0.8)] transition-all hover:scale-[1.03] active:scale-[0.97]"
          >
            Agendar agora
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
          </button>
        </div>
      </motion.div>
    </section>
  );
};

export default PingoRunBanner;
