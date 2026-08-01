import { motion } from "framer-motion";
import { Smartphone, Wifi, FileText, Clock, Pill, ShieldCheck } from "lucide-react";

const INFO_ITEMS = [
  { icon: Smartphone, label: "Pelo celular ou PC" },
  { icon: Wifi, label: "Só precisa de internet" },
  { icon: Clock, label: "Plantão 24h, todos os dias" },
  { icon: FileText, label: "Atestados e receitas digitais" },
  { icon: Pill, label: "Válido em qualquer farmácia" },
  { icon: ShieldCheck, label: "Seguro e sigiloso" },
];

const ConsultaInfoBanner = () => {
  const items = [...INFO_ITEMS, ...INFO_ITEMS];

  return (
    <section
      aria-label="Informações sobre a consulta online"
      className="relative w-full overflow-hidden border-y border-secondary/30 bg-gradient-to-r from-[hsl(168,50%,35%)] via-secondary to-[hsl(215,75%,38%)]"
    >
      {/* Padrão de linhas diagonais sutil */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0, rgba(255,255,255,0.4) 1px, transparent 0, transparent 50%)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Cabeçalho da faixa */}
      <div className="relative px-6 md:px-12 lg:px-20 pt-5 md:pt-6 pb-2">
        <motion.p
          className="text-white/70 text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] text-center"
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          Sua consulta online — simples assim
        </motion.p>
      </div>

      {/* Marquee de ícones colorido */}
      <div className="relative py-4 md:py-5">
        <motion.div
          className="flex items-center gap-8 md:gap-14 whitespace-nowrap will-change-transform"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 24, ease: "linear", repeat: Infinity }}
        >
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 md:gap-3 text-white font-semibold text-xs md:text-sm uppercase tracking-[0.12em] shrink-0"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/15 backdrop-blur-sm">
                  <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={2.5} />
                </span>
                <span>{it.label}</span>
                <span className="text-white/25 text-lg md:text-xl">•</span>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Fades laterais para suavizar */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-14 md:w-20 bg-gradient-to-r from-[hsl(168,50%,35%)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-14 md:w-20 bg-gradient-to-l from-[hsl(215,75%,38%)] to-transparent" />
    </section>
  );
};

export default ConsultaInfoBanner;
