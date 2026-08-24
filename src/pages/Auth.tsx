import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Heart, Stethoscope, ArrowRight, Mail, Lock, LogIn, ShieldCheck, Sparkles,
} from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { PINGO_LOGO_URL } from "@/lib/constants";
import mascotWelcome from "@/assets/states/pingo-acesso-seguro.webp";
import { AuthField, AuthPasswordField, AuthSubmitButton } from "@/components/auth/AuthFields";
import { translateAuthError } from "@/lib/authErrors";
import { reportFailedLogin } from "@/lib/security";

const logo = PINGO_LOGO_URL;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };

const roleCards = [
  {
    to: "/paciente",
    title: "Sou paciente",
    desc: "Consultas, receitas e histórico médico em um só lugar",
    icon: Heart,
    iconBg: "from-[hsl(195,75%,90%)] to-[hsl(340,75%,95%)]",
    iconColor: "text-[hsl(340,75%,50%)]",
    accent: "from-[hsl(195,75%,50%)] to-[hsl(340,75%,60%)]",
  },
  {
    to: "/medico",
    title: "Sou médico",
    desc: "Atenda online e gerencie sua agenda profissional",
    icon: Stethoscope,
    iconBg: "from-[hsl(210,85%,92%)] to-[hsl(160,70%,92%)]",
    iconColor: "text-[hsl(210,85%,40%)]",
    accent: "from-[hsl(210,85%,45%)] to-[hsl(160,70%,40%)]",
  },
];

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await db.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      reportFailedLogin(email);
      toast.error("Erro ao entrar", { description: translateAuthError(error.message) });
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <SEOHead
        title="Entrar — AloClínica"
        description="Escolha como você deseja acessar a AloClínica: paciente ou médico."
      />

      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[hsl(210,40%,97%)] via-background to-[hsl(340,40%,97%)] dark:from-[hsl(210,30%,8%)] dark:via-background dark:to-[hsl(340,25%,9%)]" />
      <div className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/[0.08] blur-[140px] -z-10" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[420px] h-[420px] rounded-full bg-secondary/[0.1] blur-[120px] -z-10" />

      <div className="container mx-auto px-4 py-10 lg:py-20 max-w-4xl">
        <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center mb-12">
          <motion.div variants={fadeUp} className="flex items-center justify-center gap-3 mb-7">
            <img
              src={logo}
              alt=""
              aria-hidden="true"
              className="w-12 h-12 rounded-2xl shadow-md"
              loading="eager"
              decoding="async"
              width={48}
              height={48}
            />
            <span className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              AloClínica
            </span>
          </motion.div>
          <motion.h1
            variants={fadeUp}
            className="text-[32px] lg:text-[52px] font-black text-foreground tracking-tight leading-[1.05] mb-4"
          >
            Como você quer{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/90 to-secondary">
              entrar?
            </span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="text-[15px] lg:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed"
          >
            Escolha seu perfil para acessar a plataforma de saúde digital mais completa do Brasil.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="grid sm:grid-cols-2 gap-5 mb-10"
        >
          {roleCards.map((card) => (
            <motion.div key={card.to} variants={fadeUp} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 400 }}>
              <Link
                to={card.to}
                className="group block p-6 lg:p-8 rounded-3xl bg-card border border-border hover:border-transparent hover:shadow-2xl transition-all relative overflow-hidden h-full"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-0 group-hover:opacity-[0.05] transition-opacity`}
                  aria-hidden="true"
                />
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${card.iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-sm`}
                >
                  <card.icon className={`w-8 h-8 ${card.iconColor}`} aria-hidden="true" />
                </div>
                <h2 className="text-xl lg:text-2xl font-extrabold text-foreground mb-2 tracking-tight">
                  {card.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">{card.desc}</p>
                <div className="flex items-center gap-1.5 text-sm font-bold text-primary group-hover:gap-3 transition-all">
                  Acessar <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Other roles */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-10"
        >
          <p className="text-[12.5px] text-muted-foreground/70 mb-3 font-medium uppercase tracking-wider">
            Outros acessos
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { to: "/clinica", label: "Clínica" },
              { to: "/suporte", label: "Suporte" },
              { to: "/admin", label: "Admin" },
            ].map((r) => (
              <Link
                key={r.to}
                to={r.to}
                className="px-3.5 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-full border border-border/40 transition-colors"
              >
                {r.label}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Quick login */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-md mx-auto"
        >
          {!showLogin ? (
            <button
              onClick={() => setShowLogin(true)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-3"
            >
              Já tenho conta — <span className="font-bold underline">fazer login rápido</span>
            </button>
          ) : (
            <motion.form
              onSubmit={handleLogin}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-3xl bg-card border border-border shadow-lg space-y-4"
            >
              <div className="flex items-center gap-3 mb-1">
                <img
                  src={mascotWelcome}
                  alt=""
                  aria-hidden="true"
                  className="w-11 h-11 object-contain"
                  loading="lazy"
                  decoding="async"
                  width={44}
                  height={44}
                />
                <div>
                  <p className="text-sm font-bold text-foreground">Login rápido</p>
                  <p className="text-xs text-muted-foreground">Sua conta te leva ao painel certo</p>
                </div>
              </div>

              <AuthField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                icon={Mail}
                autoComplete="email"
                required
              />

              <AuthPasswordField
                label="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                icon={Lock}
                autoComplete="current-password"
                showForgot
                required
              />

              <AuthSubmitButton
                loading={loading}
                loadingLabel="Entrando..."
                icon={<LogIn className="w-4 h-4" />}
                variantClassName="bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:brightness-110"
              >
                Entrar
              </AuthSubmitButton>

              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="w-full text-xs text-center text-muted-foreground hover:text-foreground pt-1"
              >
                Voltar aos perfis
              </button>
            </motion.form>
          )}
        </motion.div>

        <div className="flex items-center justify-center gap-6 text-[12px] text-muted-foreground mt-12">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> LGPD
          </span>
          <Link to="/terms" className="hover:underline">
            Termos
          </Link>
          <Link to="/privacy" className="hover:underline">
            Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Auth;
