import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, type LucideIcon } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { PINGO_LOGO_URL } from "@/lib/constants";

const logo = PINGO_LOGO_URL;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } };

export interface AuthShellTheme {
  /** Tailwind gradient classes for the left/hero panel, e.g. "from-primary via-primary/90 to-secondary" */
  panelGradient: string;
  /** Tailwind gradient classes for the highlight ring around mascot/icon */
  accentGradient?: string;
  /** Optional benefits list shown on desktop hero */
  benefits?: { icon: LucideIcon; title: string; desc?: string }[];
  /** Bullet list (alternative to benefits) for compact hero */
  features?: string[];
}

export interface AuthShellProps {
  /** Page <title>/SEO content */
  seoTitle: string;
  seoDescription: string;
  /** Hero icon shown if no mascot is provided */
  icon: LucideIcon;
  /** Eyebrow label (small text above title) */
  eyebrow: string;
  /** Main panel headline (HTML allowed via highlightWord) */
  headline: string;
  /** A word inside the headline to highlight with underline-bg */
  highlightWord?: string;
  /** Sub-headline beneath title */
  description: string;
  /** Optional mascot image URL */
  mascotSrc?: string;
  /** Theming tokens */
  theme: AuthShellTheme;
  /** Footer items at the bottom of the form column */
  footerItems?: { icon: LucideIcon; label: string; tone?: "default" | "success" | "danger" }[];
  /** Form / right-side content */
  children: ReactNode;
}

/**
 * Unified split-screen auth shell.
 * Mobile: hero compacto no topo + formulário abaixo.
 * Desktop: painel hero à esquerda (46%) + formulário à direita centrado.
 */
const AuthShell = ({
  seoTitle,
  seoDescription,
  icon: Icon,
  eyebrow,
  headline,
  highlightWord,
  description,
  mascotSrc,
  theme,
  footerItems,
  children,
}: AuthShellProps) => {
  const renderHeadline = () => {
    if (!highlightWord || !headline.includes(highlightWord)) {
      return headline;
    }
    const [before, after] = headline.split(highlightWord);
    return (
      <>
        {before}
        <span className="relative inline-block">
          <span className="relative z-10">{highlightWord}</span>
          <span className="absolute inset-0 bg-white/15 rounded-xl -skew-x-2 scale-x-105 scale-y-125" />
        </span>
        {after}
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <SEOHead title={seoTitle} description={seoDescription} />

      {/* ──────────── DESKTOP HERO ──────────── */}
      <aside
        className={`hidden lg:flex lg:w-[46%] xl:w-1/2 relative overflow-hidden bg-gradient-to-br ${theme.panelGradient}`}
        aria-hidden="true"
      >
        {/* Ambient orbs */}
        <div className="absolute top-[-20%] right-[-15%] w-[400px] h-[400px] rounded-full bg-white/[0.06] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[320px] h-[320px] rounded-full bg-white/[0.05] blur-[100px]" />
        <div className="absolute top-[55%] left-[60%] w-[160px] h-[160px] rounded-full bg-white/[0.04] blur-[60px]" />
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 1.5px 1.5px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Top — back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/55 hover:text-white/85 transition-colors text-sm font-medium group w-fit"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Voltar ao início
          </Link>

          {/* Center content */}
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-md">
            <motion.div variants={fadeUp} className="flex items-center gap-3 mb-7">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/[0.12] shadow-xl">
                <Icon className="w-7 h-7 text-white" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/55 font-semibold">{eyebrow}</p>
                <p className="text-lg font-bold text-white tracking-tight mt-0.5">AloClínica</p>
              </div>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-[34px] xl:text-[42px] font-black text-white leading-[1.08] tracking-tight"
            >
              {renderHeadline()}
            </motion.h1>

            <motion.p variants={fadeUp} className="text-[15px] text-white/70 mt-4 leading-relaxed max-w-sm">
              {description}
            </motion.p>

            {theme.benefits && theme.benefits.length > 0 && (
              <motion.ul variants={fadeUp} className="mt-9 space-y-3.5">
                {theme.benefits.map((b) => (
                  <li key={b.title} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/[0.1] mt-0.5">
                      <b.icon className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-white leading-tight">{b.title}</p>
                      {b.desc && <p className="text-[12.5px] text-white/65 leading-snug mt-0.5">{b.desc}</p>}
                    </div>
                  </li>
                ))}
              </motion.ul>
            )}

            {!theme.benefits && theme.features && theme.features.length > 0 && (
              <motion.ul variants={fadeUp} className="mt-9 space-y-2.5">
                {theme.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/70">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white/70" aria-hidden="true" />
                    </div>
                    {f}
                  </li>
                ))}
              </motion.ul>
            )}
          </motion.div>

          {/* Mascot */}
          {mascotSrc ? (
            <motion.div
              className="flex justify-center"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.45, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.img
                src={mascotSrc}
                alt=""
                aria-hidden="true"
                className="w-[160px] h-[160px] xl:w-[190px] xl:h-[190px] object-contain select-none"
                style={{ filter: "drop-shadow(0 12px 40px rgba(0,0,50,.45))" }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                loading="eager"
                decoding="async"
                width={190}
                height={190}
              />
            </motion.div>
          ) : (
            <div /> /* spacer */
          )}
        </div>
      </aside>

      {/* ──────────── MOBILE HERO ──────────── */}
      <header
        className={`lg:hidden relative overflow-hidden bg-gradient-to-br ${theme.panelGradient} px-4 sm:px-5 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 sm:pb-4`}
      >
        <div className="absolute top-[-30%] right-[-15%] w-[240px] h-[240px] rounded-full bg-white/[0.08] blur-[80px]" />
        <div className="absolute bottom-[-25%] left-[-15%] w-[200px] h-[200px] rounded-full bg-white/[0.06] blur-[70px]" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="text-white/70 hover:text-white transition-colors -ml-2 min-w-11 min-h-11 flex items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Voltar ao início"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <img
              src={logo}
              alt=""
              aria-hidden="true"
              className="w-8 h-8 rounded-xl ring-2 ring-white/20"
              loading="eager"
              decoding="async"
              width={32}
              height={32}
            />
            <div className="min-w-0">
              <h1 className="text-[15px] font-black text-white tracking-tight leading-none truncate">
                {eyebrow}
              </h1>
              <p className="text-[10.5px] text-white/60 mt-0.5 truncate">AloClínica</p>
            </div>
          </div>

          {mascotSrc ? (
            <motion.img
              src={mascotSrc}
              alt=""
              aria-hidden="true"
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain select-none shrink-0"
              style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,50,.35))" }}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              loading="eager"
              decoding="async"
              width={64}
              height={64}
            />
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
          )}
        </div>
      </header>

      {/* ──────────── FORM COLUMN ──────────── */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex items-start lg:items-center justify-center px-4 sm:px-5 py-5 sm:py-7 lg:px-10 lg:py-12 xl:px-16 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
          >
            {children}

            <p className="text-center text-[10.5px] text-muted-foreground/50 mt-7 sm:mt-10">
              © {new Date().getFullYear()} AloClínica — Tecnologia em Saúde
            </p>
          </motion.div>
        </div>

        {footerItems && footerItems.length > 0 && (
          <footer className="px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] border-t border-border/40 bg-muted/20 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11.5px] text-muted-foreground">
            {footerItems.map((f) => (
              <span
                key={f.label}
                className={`flex items-center gap-1.5 ${
                  f.tone === "danger" ? "text-destructive" : f.tone === "success" ? "text-success" : ""
                }`}
              >
                <f.icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {f.label}
              </span>
            ))}
          </footer>
        )}
      </main>
    </div>
  );
};

export default AuthShell;
