import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface KpiCardProps {
  label: string;
  sublabel: string;
  value: React.ReactNode;
  badge: string;
  icon: React.ElementType;
  gradient: string;
  ring: string;
  glow: string;
  sparkColor: string;
  route?: string;
  index?: number;
  onClick?: () => void;
}

const SPARK_PATHS = [
  "M2 16 L14 12 L26 14 L38 8 L50 11 L62 7 L74 10 L86 5 L98 8 L110 4 L122 6",
  "M2 13 L14 10 L26 12 L38 6 L50 9 L62 5 L74 8 L86 3 L98 6 L110 2 L122 4",
  "M2 12 L14 8 L26 11 L38 5 L50 7 L62 3 L74 6 L86 2 L98 5 L110 1 L122 3",
  "M2 14 L14 11 L26 13 L38 7 L50 9 L62 4 L74 8 L86 2 L98 5 L110 3 L122 2",
  "M2 15 L14 13 L26 14 L38 9 L50 11 L62 6 L74 10 L86 4 L98 7 L110 5 L122 3",
];

export function KpiCard({
  label,
  sublabel,
  value,
  badge,
  icon: Icon,
  gradient,
  ring,
  glow,
  sparkColor,
  route,
  index = 0,
  onClick,
}: KpiCardProps) {
  const sparkPath = useMemo(() => SPARK_PATHS[index % SPARK_PATHS.length], [index]);
  const clickable = Boolean(route || onClick);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={clickable ? { y: -4 } : undefined}
      whileTap={clickable ? { scale: 0.98 } : undefined}
    >
      <Card
        onClick={onClick}
        className={cn(
          "relative h-full overflow-hidden border-border/40 bg-card/95 backdrop-blur-sm",
          "shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]",
          "hover:shadow-[0_12px_28px_-8px_rgba(0,0,0,0.12)] hover:border-border/60",
          "transition-all duration-300 group",
          clickable && "cursor-pointer",
          glow
        )}
      >
        {/* Top accent line */}
        <div className={cn("absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity", gradient)} />

        {/* Subtle corner glow */}
        <div className={cn("absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br opacity-[0.07] blur-2xl pointer-events-none", gradient)} />

        <CardContent className="relative p-4 sm:p-5 flex flex-col h-full">
          {/* Header: icon + badge */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className={cn(
              "w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-md",
              "ring-1 ring-white/25 dark:ring-white/10",
              "transition-transform duration-300 group-hover:scale-105",
              gradient
            )}>
              <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <span className={cn(
              "text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full",
              "bg-background/80 border border-border/50 text-muted-foreground",
              "backdrop-blur-sm"
            )}>
              {badge}
            </span>
          </div>

          {/* Value */}
          <div className="text-3xl sm:text-4xl font-black tabular-nums leading-none text-foreground tracking-tight">
            {value}
          </div>

          {/* Label + sublabel */}
          <div className="text-[11px] font-bold uppercase tracking-wider text-foreground/90 mt-2">
            {label}
          </div>
          <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
            {sublabel}
          </p>

          {/* Sparkline */}
          <div className="mt-auto pt-3">
            <svg
              viewBox="0 0 124 22"
              className="w-full h-5"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d={sparkPath}
                className={cn(sparkColor, "opacity-60 group-hover:opacity-100 transition-opacity")}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
