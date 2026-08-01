import { Link } from "react-router-dom";
import { ArrowLeft, LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

import bannerLegal from "@/assets/banner-legal-hero.jpg";

interface InstitutionalHeroProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  lastUpdate?: string;
}

const InstitutionalHero = ({ title, subtitle, icon: Icon, lastUpdate }: InstitutionalHeroProps) => (
  <section className="section-band band-deep">
    <img
      src={bannerLegal}
      alt=""
      aria-hidden="true"
      className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity"
      loading="eager"
      decoding="async"
    />
    <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-[hsl(var(--pingo-mint)/0.28)] blur-3xl pointer-events-none" />
    <div className="absolute -bottom-28 -left-10 w-80 h-80 rounded-full bg-[hsl(var(--pingo-sky)/0.25)] blur-3xl pointer-events-none" />

    <div className="section-inner">
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-3xl"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-white/75 hover:text-white transition-colors text-sm font-semibold mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao início
        </Link>

        <div className="flex items-start gap-4">
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-white/12 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-[0_12px_30px_-14px_rgba(0,0,0,0.6)]">
            <Icon className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="section-title text-white">{title}</h1>
            {subtitle && <p className="section-lead mt-3">{subtitle}</p>}
          </div>
        </div>

        {lastUpdate && (
          <p className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/65 border border-white/15 bg-white/8 rounded-full px-3 py-1.5">
            Atualizado em {lastUpdate}
          </p>
        )}
      </motion.div>
    </div>
  </section>
);

export default InstitutionalHero;
