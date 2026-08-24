import { logError } from "@/lib/logger";
import { useLocation, Link } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { Home, ArrowLeft, Stethoscope, User, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/SEOHead";
import { motion } from "framer-motion";
import mascotImg from "@/assets/states/pingo-pagina-nao-encontrada.webp";

const suggestions = [
  { label: "Página inicial", path: "/", icon: Home },
  { label: "Área do Paciente", path: "/paciente", icon: User },
  { label: "Área do Médico", path: "/medico", icon: Stethoscope },
  { label: "Ajuda", path: "/terms", icon: HelpCircle },
];

const REDIRECT_SECONDS = 15;

const NotFound = () => {
  const location = useLocation();
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    logError("404 - route not found", null, { pathname: location.pathname });
  }, [location.pathname]);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = "/";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [paused]);

  const handleGoNow = useCallback(() => {
    window.location.href = "/";
  }, []);

  const progress = ((REDIRECT_SECONDS - countdown) / REDIRECT_SECONDS) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-background">
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-primary/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[350px] h-[350px] rounded-full bg-secondary/[0.04] blur-[100px]" />
      </div>

      <SEOHead title="Página não encontrada" description="A página que você procura não existe." />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-md w-full"
      >
        {/* Mascot */}
        <motion.img
          src={mascotImg}
          alt="Pingo confusa"
          className="w-32 h-32 mx-auto mb-6 object-contain"
          animate={{ rotate: [-5, 5, -5] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          loading="lazy"
        />

        {/* 404 */}
        <div className="text-[96px] font-black text-primary/15 leading-none select-none tracking-tighter mb-2">
          404
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Página não encontrada</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Parece que você se perdeu... Mas não se preocupe!
        </p>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {suggestions.map(s => {
            const Icon = s.icon;
            return (
              <Link
                key={s.path}
                to={s.path}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
              >
                <Icon className="w-3 h-3" />
                {s.label}
              </Link>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Button size="lg" className="rounded-full" onClick={handleGoNow}>
            <Home className="w-4 h-4 mr-2" /> Ir agora
          </Button>
          <Button variant="outline" size="lg" className="rounded-full" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>

        {/* Countdown + progress bar */}
        {!paused && countdown > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground/60">
              Voltando ao início em {countdown}s...{" "}
              <button
                onClick={() => setPaused(true)}
                className="text-primary hover:underline font-medium"
              >
                Cancelar
              </button>
            </p>
            <div className="w-full max-w-[200px] mx-auto h-1 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default NotFound;
