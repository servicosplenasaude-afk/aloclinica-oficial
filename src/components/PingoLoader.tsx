import { memo } from "react";
import { motion } from "framer-motion";
import { PINGO_LOGO_URL } from "@/lib/constants";
const mascotImg = PINGO_LOGO_URL;

const PingoLoader = memo(() => (
  <motion.div
    className="relative flex flex-col items-center justify-center min-h-screen bg-background gap-6 overflow-hidden"
    initial={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
  >
    {/* Ambient light */}
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/10 blur-[90px]" />
    </div>

    {/* Mascot with orbit ring */}
    <div className="relative flex items-center justify-center">
      <motion.span
        className="absolute h-32 w-32 md:h-36 md:w-36 rounded-full border border-primary/15"
        animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2.4, ease: "easeOut", repeat: Infinity }}
      />
      <motion.span
        className="absolute h-28 w-28 md:h-32 md:w-32 rounded-full border-2 border-transparent border-t-primary/70 border-r-secondary/50"
        animate={{ rotate: 360 }}
        transition={{ duration: 2.2, ease: "linear", repeat: Infinity }}
      />
      <div className="relative flex h-24 w-24 md:h-28 md:w-28 items-center justify-center rounded-full bg-card/80 shadow-[0_18px_45px_-18px_hsl(var(--primary)/0.55)] ring-1 ring-border/60 backdrop-blur-sm">
        <motion.img
          src={mascotImg}
          alt="Pingo carregando"
          className="w-16 h-16 md:w-20 md:h-20 object-contain"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
          draggable={false}
          width={80}
          height={80}
        />
      </div>
    </div>

    <div className="relative flex flex-col items-center gap-3">
      <p className="text-sm font-semibold tracking-tight text-foreground">Carregando</p>

      {/* Progress shimmer bar */}
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary via-secondary to-primary"
          animate={{ x: ["-120%", "320%"] }}
          transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
        />
      </div>

      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Alô Clínica
      </p>
    </div>
  </motion.div>
));

PingoLoader.displayName = "PingoLoader";
export default PingoLoader;
