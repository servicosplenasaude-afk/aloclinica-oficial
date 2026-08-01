import { forwardRef, useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Users, Stethoscope, Star, ShieldCheck } from "@phosphor-icons/react";
import { db } from "@/integrations/supabase/untyped";
import { useSiteConfig } from "@/lib/site-config";

const fallbackStats = [
  { icon: Users, value: "24h", label: "Atendimento" },
  { icon: Stethoscope, value: "Especialidades", label: "Múltiplas áreas médicas" },
  { icon: ShieldCheck, value: "CFM", label: "Médicos verificados" },
  { icon: ShieldCheck, value: "LGPD", label: "Privacidade protegida" },
];

const AnimatedCounter = ({ value, suffix = "" }: { value: string; suffix?: string }) => {
  const numMatch = value.match(/[\d.]+/);
  const prefix = value.replace(/[\d.]+.*/, "");
  const num = numMatch ? parseFloat(numMatch[0]) : 0;
  const rest = numMatch ? value.slice((prefix + numMatch[0]).length) : "";
  const [display, setDisplay] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!numMatch || hasAnimated || !ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasAnimated(true);
        observer.disconnect();
        const duration = 1200;
        const start = performance.now();
        const animate = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(eased * num * 10) / 10);
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.3 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasAnimated, num]);

  if (!numMatch) return <span>{value}</span>;

  return (
    <p ref={ref} className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground leading-none tabular-nums">
      {prefix}{Number.isInteger(num) ? Math.round(display) : display.toFixed(1)}{rest}{suffix}
    </p>
  );
};

const StatsSection = forwardRef<HTMLElement>((_, ref) => {
  const [stats, setStats] = useState(fallbackStats);
  const { get, loading: configLoading } = useSiteConfig();

  useEffect(() => {
    (async () => {
      try {
        const [specialtiesRes] = await Promise.all([
          db.from("specialties").select("id", { count: "exact", head: true }),
        ]);
        const specialties = specialtiesRes.count ?? 0;

        setStats((prev) => prev.map((s, i) => {
          // Use site_config custom values when non-empty
          const cfgValue = !configLoading ? get(`stat_${i + 1}_value`, "") : "";
          const cfgLabel = !configLoading ? get(`stat_${i + 1}_label`, "") : "";
          return {
            ...s,
            value: cfgValue || (i === 1 && specialties > 5 ? `+${specialties}` : s.value),
            label: cfgLabel || s.label,
          };
        }));
      } catch { /* keep fallback */ }
    })();
  }, [configLoading, get]);

  return (
    <section ref={ref} className="py-8 md:py-12 relative">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              className="group flex items-center gap-3.5 rounded-2xl bg-card/90 backdrop-blur-sm border border-border/25 px-5 py-5 sm:py-6 hover:shadow-xl hover:border-primary/20 transition-all duration-300 cursor-default"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-300">
                <stat.icon className="w-5 h-5 text-primary group-hover:text-primary-foreground transition-colors duration-300" weight="fill" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <AnimatedCounter value={stat.value} />
                <p className="mt-1 text-xs text-muted-foreground font-semibold truncate">
                  {stat.label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});

StatsSection.displayName = "StatsSection";
export default StatsSection;
