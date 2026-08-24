import { ReactNode } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import doctorAppHero from "@/assets/states/pingo-comando-medico.webp";
import mascotWelcome from "@/assets/states/pingo-boas-vindas-medico.webp";

interface DoctorAppHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  stats?: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
}

const DoctorAppHeader = ({ eyebrow, title, description, icon: Icon, stats = [], actions }: DoctorAppHeaderProps) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-[30px] border border-border/60 bg-card shadow-sm"
    >
      <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                <Icon className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
              <h1 className="text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            {actions && <div className="hidden shrink-0 flex-wrap items-center gap-2 sm:flex">{actions}</div>}
          </div>

          {stats.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/55 bg-background/70 p-3">
                  <p className="text-2xl font-black leading-none text-foreground tabular-nums">{item.value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          )}

          {actions && <div className="mt-5 grid gap-2 sm:hidden">{actions}</div>}
        </div>

        <div className="border-t border-border/60 bg-muted/25 p-4 sm:p-6 lg:border-l lg:border-t-0">
          <div className="relative h-full min-h-[150px] overflow-hidden rounded-3xl border border-border/50 bg-background">
            <img src={doctorAppHero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            <img src={mascotWelcome} alt="Pingo" className="absolute bottom-3 right-3 h-20 w-20 object-contain drop-shadow-md" />
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default DoctorAppHeader;
