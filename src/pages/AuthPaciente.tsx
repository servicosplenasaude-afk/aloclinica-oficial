import { logError } from "@/lib/logger";
import { useState, useRef, useEffect, useMemo } from "react";
import { securityMonitor } from "@/lib/security-monitor";
import { useNavigate, Link } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Envelope,
  Lock,
  ArrowLeft,
  ShieldCheck,
  Eye,
  EyeSlash,
  UserPlus,
  SpinnerGap,
  Stethoscope,
  Clock,
  Lightning,
  Heartbeat,
  CheckCircle,
  Phone,
  IdentificationCard,
  FacebookLogo,
  Certificate,
  LockKey,
  VideoCamera,
  SignIn,
  User,
  Confetti,
  WarningCircle,
} from "@phosphor-icons/react";
import TermsConsentCheckbox from "@/components/auth/TermsConsentCheckbox";
import { registerConsent } from "@/lib/consent";
import { formatMask, unmask } from "@/hooks/use-mask";
import { validarCPF } from "@/lib/form-validators";
import CpfInput from "@/components/ui/cpf-input";
import { CalendarBlank } from "@phosphor-icons/react";
import SEOHead from "@/components/SEOHead";
import PasswordStrength from "@/components/ui/password-strength";
import { translateAuthError } from "@/lib/authErrors";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { PINGO_LOGO_URL } from "@/lib/constants";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";
const logo = PINGO_LOGO_URL;
import mascotWave from "@/assets/mascot-wave.png";
import mascotThumbsup from "@/assets/mascot-thumbsup.png";

const benefits = [
  { icon: VideoCamera, text: "Videochamada HD criptografada" },
  { icon: ShieldCheck, text: "Médicos verificados pelo CFM" },
  { icon: Lightning, text: "Atendimento em até 10 minutos" },
];

/* ═══ LEFT PANEL (Desktop only) — extracted outside to avoid remount on every keystroke ═══ */
const LeftPanel = () => (
  <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[hsl(220,75%,38%)] via-[hsl(200,70%,45%)] to-[hsl(165,65%,50%)] flex-col justify-between p-12 xl:p-16 overflow-hidden">
    {/* Ambient orbs */}
    <div className="absolute top-[-20%] right-[-15%] w-[400px] h-[400px] rounded-full bg-white/[0.08] blur-[120px]" />
    <div className="absolute bottom-[-10%] left-[-10%] w-[320px] h-[320px] rounded-full bg-emerald-400/20 blur-[80px]" />
    <div className="absolute top-[50%] left-[60%] w-[150px] h-[150px] rounded-full bg-white/[0.04] blur-[60px]" />
    {/* Dot pattern */}
    <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1.5px 1.5px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />

    {/* Top — back link */}
    <div className="relative z-10">
      <Link to="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-semibold group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" weight="bold" />
        Voltar ao início
      </Link>
    </div>

    {/* Center content */}
    <div className="relative z-10 flex flex-col items-start text-left max-w-md">
      {/* Mascot with floating heart badge */}
      <div className="relative w-full flex justify-center mb-10">
        <div className="absolute inset-x-0 top-6 h-[220px] bg-white/[0.07] rounded-[50%] blur-2xl" />
        <motion.img
          src={mascotWave}
          alt="Pingo"
          className="relative w-[220px] h-[220px] xl:w-[250px] xl:h-[250px] object-contain select-none"
          style={{ filter: "drop-shadow(0 18px 50px rgba(0,0,50,.45))" }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-4 right-12 xl:right-16 w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        >
          <Heartbeat className="w-6 h-6 text-white" weight="fill" />
        </motion.div>
      </div>

      <h1 className="text-[42px] xl:text-[52px] font-extrabold text-white leading-[1.05] tracking-tight">
        Sua saúde<br />em boas{" "}
        <span className="text-emerald-300">mãos</span>
      </h1>
      <p className="text-white/70 mt-4 text-[15px] leading-relaxed max-w-sm">
        Consulte médicos online 24h, em qualquer<br />lugar do Brasil.
      </p>

      <div className="mt-8 space-y-3.5 w-full max-w-sm">
        {benefits.map((b, i) => (
          <motion.div
            key={b.text}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.12 }}
            className="flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/[0.1]">
              <b.icon className="w-5 h-5 text-white" weight="fill" />
            </div>
            <span className="text-[14px] text-white/90 font-medium">{b.text}</span>
          </motion.div>
        ))}
      </div>
    </div>

    {/* Bottom — rating card with avatars */}
    <div className="relative z-10 w-full max-w-sm">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/[0.12] shadow-xl">
        <div className="w-10 h-10 rounded-xl bg-emerald-400/20 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-emerald-300" weight="fill" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-white">CFM</span>
            <span className="text-[11px] text-white/70 truncate">— Médicos verificados no Brasil</span>
          </div>
        </div>
        <div className="flex -space-x-2 shrink-0">
          {[
            "https://i.pravatar.cc/40?img=1",
            "https://i.pravatar.cc/40?img=5",
            "https://i.pravatar.cc/40?img=12",
          ].map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              loading="lazy"
              className="w-7 h-7 rounded-full border-2 border-primary/40 object-cover"
            />
          ))}
          <div className="w-7 h-7 rounded-full bg-white/15 backdrop-blur-sm border-2 border-primary/40 flex items-center justify-center text-[9px] font-bold text-white">
            CFM
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ═══ STEP INDICATOR — extracted outside ═══ */
const STEP_LABELS = ["Você", "Acesso", "Pronto!"] as const;
const StepIndicator = ({ current }: { current: number }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center gap-2 flex-1">
          <div className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${
            step < current ? "bg-emerald-500" : step === current ? "bg-primary" : "bg-muted"
          }`} />
        </div>
      ))}
    </div>
    <div className="flex items-center justify-between mt-2">
      <p className="text-xs font-semibold text-foreground">
        Etapa {current} de 3 · <span className="text-primary">{STEP_LABELS[current - 1]}</span>
      </p>
      <span className="text-[11px] text-muted-foreground">{Math.round((current / 3) * 100)}%</span>
    </div>
  </div>
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const AuthPaciente = () => {
  const [mode, setMode] = useState<"welcome" | "login" | "signup">("login");
  const [email, setEmail] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("email");
      return p && p.includes("@") ? p : "";
    }
    return "";
  });
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupHasSession, setSignupHasSession] = useState(false);
  const lockoutUntil = useRef<number>(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { redirectAfterLogin } = useAuthRedirect();

  // ── Real-time per-field validation ───────────────────────────────
  const cleanCpf = useMemo(() => unmask(cpf), [cpf]);
  const cleanPhone = useMemo(() => unmask(phone), [phone]);
  const isFirstNameValid = firstName.trim().length >= 2;
  const isLastNameValid = lastName.trim().length >= 2;
  const isCpfValid = cleanCpf.length === 11 && validarCPF(cleanCpf);
  const userAge = useMemo(() => {
    if (!birthDate) return null;
    const t = new Date();
    const b = new Date(birthDate);
    let a = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
  }, [birthDate]);
  const isBirthValid = userAge !== null && userAge >= 16 && userAge <= 120;
  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const isPasswordValid = password.length >= 6;
  const isPhoneValid = cleanPhone.length >= 10;

  const isStep1Valid = isFirstNameValid && isLastNameValid && isCpfValid && isBirthValid;
  const isStep2Valid = isEmailValid && isPasswordValid && isPhoneValid;

  // Auto-focus on mode change
  useEffect(() => {
    if (mode === "login") setTimeout(() => emailRef.current?.focus(), 100);
    if (mode === "signup") setTimeout(() => firstNameRef.current?.focus(), 100);
  }, [mode]);

  // Reset success state when leaving signup
  useEffect(() => {
    if (mode !== "signup") {
      setSignupSuccess(false);
      setSignupStep(1);
    }
  }, [mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < lockoutUntil.current) {
      const secs = Math.ceil((lockoutUntil.current - Date.now()) / 1000);
      toast.error("Aguarde", { description: `Tente novamente em ${secs}s` });
      return;
    }
    if (securityMonitor.isLoginBlocked(email)) {
      toast.error("Conta temporariamente bloqueada", { description: "Muitas tentativas. Aguarde 15 minutos." });
      return;
    }
    setLoading(true);
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      securityMonitor.trackFailedLogin(email);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      if (newAttempts >= 5) {
        lockoutUntil.current = Date.now() + 30000;
        setAttempts(0);
        toast.error("Muitas tentativas", { description: "Conta bloqueada por 30 segundos." });
      } else {
        toast.error("Erro ao entrar", { description: translateAuthError(error.message) });
      }
    } else if (data.user) {
      setAttempts(0);
      securityMonitor.clearFailedLogins(email);
      setLoading(false);
      await redirectAfterLogin(data.user.id);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Dados incompletos", { description: "Preencha seu nome e sobrenome." });
      return;
    }
    const cleanCpf = unmask(cpf);
    if (!validarCPF(cleanCpf)) {
      toast.error("CPF inválido", { description: "O CPF informado não é válido. Verifique os dígitos e tente novamente." });
      return;
    }
    const cleanPhone = unmask(phone);
    if (cleanPhone.length < 10) {
      toast.error("Telefone inválido", { description: "Digite um telefone válido." });
      return;
    }
    if (!email || !email.includes("@")) {
      toast.error("Email inválido", { description: "Digite um email válido." });
      return;
    }
    if (password.length < 6) {
      toast.error("Senha fraca", { description: "A senha deve ter no mínimo 6 caracteres." });
      return;
    }
    if (!termsAccepted) {
      toast.error("Aceite os termos", { description: "Você precisa aceitar os Termos de Uso e Política de Privacidade para continuar." });
      return;
    }

    setLoading(true);
    try {
      // Pré-checagem: CPF já cadastrado evita erro 500 no signup
      const { data: cpfExists } = await db.rpc("cpf_in_use", { _cpf: cleanCpf });
      if (cpfExists === true) {
        toast.error("CPF já cadastrado", {
          description: "Este CPF já está vinculado a uma conta. Faça login ou use 'Esqueci minha senha'.",
        });
        setMode("login");
        setLoading(false);
        return;
      }

      const { data: signUpData, error: signUpError } = await db.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            // role lido pelo trigger handle_new_user para popular user_roles
            role: "patient",
            first_name: firstName,
            last_name: lastName,
            cpf: cleanCpf,
            phone: cleanPhone,
            date_of_birth: birthDate || null,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast.error("Email já cadastrado", { description: "Tente fazer login." });
          setMode("login");
          setLoading(false);
          return;
        }
        if (signUpError.message.includes("CPF_ALREADY_REGISTERED")) {
          toast.error("CPF já cadastrado", {
            description: "Este CPF já está vinculado a uma conta. Faça login ou use 'Esqueci minha senha'.",
          });
          setMode("login");
          setLoading(false);
          return;
        }
        toast.error("Erro ao criar conta", { description: translateAuthError(signUpError.message) });
        setLoading(false);
        return;
      }

      if (signUpData.user?.identities?.length === 0) {
        toast.error("Email já cadastrado", { description: "Essa conta já existe. Entre com sua senha ou use Esqueci minha senha." });
        setMode("login");
        setLoading(false);
        return;
      }

      if (signUpData.user) {
        const userId = signUpData.user.id;

        if (signUpData.session) {
          const { error: profileError } = await db.from("profiles").upsert({
            user_id: userId,
            cpf: cleanCpf,
            phone: cleanPhone,
            first_name: firstName,
            last_name: lastName,
            date_of_birth: birthDate || null,
          }, { onConflict: "user_id" });

          if (profileError) {
            logError("profile upsert error", profileError, { userId });
          }

          await registerConsent(userId);
        }

        try {
          await db.functions.invoke("send-email", {
            body: { type: "welcome", to: email, data: { name: firstName } },
          });
        } catch {}

        if (signUpData.session) {
          // Show celebration screen briefly, then redirect
          setSignupSuccess(true);
          setSignupHasSession(true);
          setTimeout(() => {
            try {
              navigate("/dashboard?role=patient&onboarding=true", { replace: true });
            } catch {
              window.location.href = "/dashboard?role=patient&onboarding=true";
            }
          }, 2400);
          // Hard fallback: if navigation doesn't take effect (e.g. blocked by guard), force reload
          setTimeout(() => {
            if (window.location.pathname.includes("/auth")) {
              window.location.href = "/dashboard?role=patient&onboarding=true";
            }
          }, 5000);
        } else {
          setSignupSuccess(true);
          setSignupHasSession(false);
          // Sem sessão: confirmação de e-mail necessária. Não tente redirecionar para dashboard.
        }
      }
    } catch (err) {
      logError("handleSignup error", err);
      toast.error("Erro inesperado", { description: "Tente novamente." });
    }
    setLoading(false);
  };



  /* ═══ FORM CONTENT — rendered as inline JSX, not a sub-component ═══ */
  const formContent = (
    <AnimatePresence mode="wait">
      {/* ── WELCOME ── */}
      {mode === "welcome" && (
        <motion.div
          key="welcome-form"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Back to landing — desktop */}
          <Link
            to="/"
            className="hidden lg:inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Voltar ao início
          </Link>

          <div className="text-center">
            <h2 className="text-[28px] font-extrabold text-foreground tracking-tight">Bem-vindo! 👋</h2>
            <p className="text-muted-foreground mt-1">Como deseja continuar?</p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => setMode("login")}
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 active:scale-[0.98] transition-all"
              size="lg"
            >
              <SignIn className="w-5 h-5 mr-2.5" weight="bold" />
              Já sou paciente
            </Button>

            <Button
              onClick={() => setMode("signup")}
              variant="outline"
              className="w-full h-14 rounded-2xl text-base font-semibold border-border/60 hover:bg-muted/50 transition-all active:scale-[0.98]"
              size="lg"
            >
              <UserPlus className="w-5 h-5 mr-2.5" weight="fill" />
              Criar nova conta
            </Button>
          </div>

          <div className="flex items-center justify-center gap-6 pt-4 grayscale opacity-60">
            {[
              { icon: LockKey, label: "Criptografado" },
              { icon: ShieldCheck, label: "CFM" },
              { icon: Clock, label: "24h" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1.5">
                <item.icon className="w-4 h-4 text-muted-foreground" weight="fill" />
                <span className="text-[10px] text-muted-foreground font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── LOGIN ── */}
      {mode === "login" && (
        <motion.div
          key="login-form"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          {/* Desktop back */}
          <button
            type="button"
            onClick={() => setMode("welcome")}
            className="hidden lg:flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 ring-1 ring-primary/20">
              <SignIn className="w-8 h-8 text-primary" weight="bold" />
            </div>
            <h2 className="text-[32px] font-black text-foreground tracking-tight leading-tight">
              Acesse sua conta
            </h2>
            <p className="text-muted-foreground mt-2 text-base">
              Bem-vindo de volta! Sentimos sua falta.
            </p>
          </div>

          <motion.form
            onSubmit={handleLogin}
            className="space-y-5"
            animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            <div className="space-y-2">
              <Label className="text-sm font-bold text-foreground ml-1">Email</Label>
              <div className="relative group">
                <Envelope className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" weight="fill" />
                <Input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="pl-12 h-14 rounded-2xl bg-muted/30 border-border/40 shadow-none focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary/50 text-base transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <Label className="text-sm font-bold text-foreground">Senha</Label>
                <Link to="/forgot-password" className="text-[13px] font-bold text-primary hover:text-primary/80 transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" weight="fill" />
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-12 pr-12 h-14 rounded-2xl bg-muted/30 border-border/40 shadow-none focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary/50 text-base transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-[hsl(220,75%,42%)] via-[hsl(195,72%,48%)] to-[hsl(165,65%,48%)] text-white font-black text-base shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] transition-all border-0"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <SpinnerGap className="w-5 h-5 animate-spin" /> Acessando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Entrar no portal <SignIn className="w-5 h-5" weight="bold" />
                </span>
              )}
            </Button>
          </motion.form>

          <SocialAuthButtons redirectTo="/dashboard?role=patient" />

          {/* Trust row */}
          <div className="flex items-center justify-center gap-6 mt-8">
            {[
              { icon: LockKey, label: "Dados\ncriptografados" },
              { icon: VideoCamera, label: "Vídeo HD\nseguro" },
              { icon: Clock, label: "Atendimento\n24h" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1.5 text-center">
                <item.icon className="w-[18px] h-[18px] text-muted-foreground/40" weight="fill" />
                <span className="text-[10px] text-muted-foreground/50 font-medium leading-tight whitespace-pre-line">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="text-center space-y-4 mt-10">
            <p className="text-sm text-muted-foreground">
              Ainda não tem uma conta?
            </p>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setMode("signup")} 
              className="w-full h-12 rounded-xl border-primary/20 text-primary font-bold hover:bg-primary/5 hover:border-primary/40 transition-all"
            >
              Começar agora — É grátis
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── SIGNUP ── */}
      {mode === "signup" && (
        <motion.div
          key="signup-form"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          {/* ═══ SUCCESS SCREEN ═══ */}
          {signupSuccess ? (
            <motion.div
              key="signup-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="text-center py-6"
            >
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
                className="relative mx-auto w-32 h-32 mb-6"
              >
                <div className="absolute inset-0 rounded-full bg-emerald-500/10" />
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-emerald-500/30"
                  animate={{ scale: [1, 1.3, 1.3], opacity: [0.7, 0, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <img
                  src={mascotThumbsup}
                  alt="Pingo comemorando"
                  className="absolute inset-0 w-full h-full object-contain p-3"
                />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-2xl font-extrabold text-foreground tracking-tight"
              >
                Bem-vindo(a), {firstName}! 🎉
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 }}
                className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed"
              >
                {signupHasSession
                  ? "Sua conta foi criada com sucesso. Vamos preparar tudo para sua primeira consulta."
                  : "Sua conta foi criada! Enviamos um e-mail de confirmação. Verifique sua caixa de entrada para entrar."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="mt-6 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground"
              >
                {signupHasSession ? (
                  <>
                    <div className="flex items-center gap-2">
                      <SpinnerGap className="w-4 h-4 animate-spin text-primary" />
                      Direcionando para o seu painel...
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = "/dashboard?role=patient&onboarding=true";
                      }}
                      className="text-[12px] font-semibold text-primary hover:underline"
                    >
                      Ir agora →
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-[12.5px] font-bold hover:bg-primary/90 transition-colors"
                  >
                    Ir para o login
                  </button>
                )}
              </motion.div>
            </motion.div>
          ) : (
          <>
          {/* Desktop back */}
          <button
            type="button"
            onClick={() => signupStep > 1 ? setSignupStep(s => s - 1) : setMode("welcome")}
            className="hidden lg:flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {signupStep > 1 ? "Voltar" : "Início"}
          </button>

          <div className="mb-2">
            <h2 className="text-[24px] font-extrabold text-foreground tracking-tight">
              {signupStep === 1 && "Vamos nos conhecer"}
              {signupStep === 2 && "Crie seu acesso"}
              {signupStep === 3 && "Quase lá!"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {signupStep === 1 && "Conte-nos quem você é"}
              {signupStep === 2 && "Email e senha para entrar quando quiser"}
              {signupStep === 3 && "Confira seus dados e finalize"}
            </p>
          </div>

          <StepIndicator current={signupStep} />

          <form onSubmit={(e) => {
            e.preventDefault();
            if (signupStep < 3) {
              if (signupStep === 1 && !isStep1Valid) {
                if (!isFirstNameValid || !isLastNameValid) toast.error("Preencha seu nome completo.");
                else if (!isCpfValid) toast.error("CPF inválido", { description: "Verifique os dígitos." });
                else if (userAge !== null && userAge < 16) toast.error("Idade mínima: 16 anos");
                else toast.error("Preencha todos os campos corretamente");
                return;
              }
              if (signupStep === 2 && !isStep2Valid) {
                if (!isEmailValid) toast.error("Email inválido");
                else if (!isPasswordValid) toast.error("Senha deve ter 6+ caracteres");
                else if (!isPhoneValid) toast.error("Telefone inválido");
                return;
              }
              setSignupStep(s => s + 1);
            } else {
              handleSignup(e);
            }
          }} className="space-y-4">
            <AnimatePresence mode="wait">
              {/* Step 1: Nome + CPF + Nascimento */}
              {signupStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[13px] font-semibold text-foreground">Nome</Label>
                      <div className="relative mt-1.5">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/50" weight="fill" />
                        <Input
                          ref={firstNameRef}
                          value={firstName}
                          onChange={e => setFirstName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); lastNameRef.current?.focus(); } }}
                          placeholder="João"
                          required
                          autoComplete="given-name"
                          className={`pl-11 h-12 rounded-xl bg-muted/40 border text-[15px] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] focus-visible:border-primary/40 ${isFirstNameValid ? "border-emerald-500/40 pr-10" : "border-border/50"}`}
                        />
                        {isFirstNameValid && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-emerald-500" weight="fill" />}
                      </div>
                    </div>
                    <div>
                      <Label className="text-[13px] font-semibold text-foreground">Sobrenome</Label>
                      <div className="relative mt-1.5">
                        <Input
                          ref={lastNameRef}
                          value={lastName}
                          onChange={e => setLastName(e.target.value)}
                          placeholder="Silva"
                          required
                          autoComplete="family-name"
                          className={`h-12 rounded-xl bg-muted/40 border text-[15px] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] focus-visible:border-primary/40 ${isLastNameValid ? "border-emerald-500/40 pr-10" : "border-border/50"}`}
                        />
                        {isLastNameValid && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-emerald-500" weight="fill" />}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-[13px] font-semibold text-foreground">CPF</Label>
                    <div className="relative">
                      <CpfInput
                        value={cpf}
                        onChange={v => setCpf(v)}
                        className="mt-1.5"
                        inputClassName={`pl-11 pr-10 h-12 rounded-xl bg-muted/40 border text-[15px] tracking-wide focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] focus-visible:border-primary/40 ${isCpfValid ? "border-emerald-500/40" : cleanCpf.length === 11 && !isCpfValid ? "border-destructive/50" : "border-border/50"}`}
                      />
                      {isCpfValid && <CheckCircle className="absolute right-3 top-[calc(50%+3px)] w-[18px] h-[18px] text-emerald-500 pointer-events-none" weight="fill" />}
                      {cleanCpf.length === 11 && !isCpfValid && <WarningCircle className="absolute right-3 top-[calc(50%+3px)] w-[18px] h-[18px] text-destructive pointer-events-none" weight="fill" />}
                    </div>
                    {cleanCpf.length === 11 && !isCpfValid && (
                      <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                        <WarningCircle className="w-3 h-3" weight="fill" /> CPF inválido — confira os dígitos
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-[13px] font-semibold text-foreground">Data de nascimento</Label>
                    <div className="relative mt-1.5">
                      <CalendarBlank className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/50" weight="fill" />
                      <Input
                        type="date"
                        value={birthDate}
                        onChange={e => setBirthDate(e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        className={`pl-11 pr-10 h-12 rounded-xl bg-muted/40 border text-[15px] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] focus-visible:border-primary/40 ${isBirthValid ? "border-emerald-500/40" : "border-border/50"}`}
                        required
                      />
                      {isBirthValid && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-emerald-500 pointer-events-none" weight="fill" />}
                    </div>
                    {userAge !== null && userAge < 16 && (
                      <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                        <WarningCircle className="w-3 h-3" weight="fill" /> Idade mínima de 16 anos
                      </p>
                    )}
                    {isBirthValid && (
                      <p className="text-xs text-muted-foreground mt-1.5">Você tem {userAge} anos</p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Email + Senha + Telefone */}
              {signupStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div>
                    <Label className="text-[13px] font-semibold text-foreground">Email</Label>
                    <div className="relative mt-1.5">
                      <Envelope className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/50" weight="fill" />
                      <Input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && isEmailValid) { e.preventDefault(); passwordRef.current?.focus(); } }}
                        placeholder="seu@email.com"
                        autoComplete="email"
                        className={`pl-11 pr-10 h-12 rounded-xl bg-muted/40 border text-[15px] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] focus-visible:border-primary/40 ${isEmailValid ? "border-emerald-500/40" : email.length > 3 && !isEmailValid ? "border-destructive/50" : "border-border/50"}`}
                        required
                      />
                      {isEmailValid && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-emerald-500 pointer-events-none" weight="fill" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">Usaremos para enviar confirmações de consultas</p>
                  </div>

                  <div>
                    <Label className="text-[13px] font-semibold text-foreground">Crie uma senha</Label>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/50" weight="fill" />
                      <Input
                        ref={passwordRef}
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && isPasswordValid) { e.preventDefault(); phoneRef.current?.focus(); } }}
                        placeholder="Mínimo 6 caracteres"
                        autoComplete="new-password"
                        className={`pl-11 pr-11 h-12 rounded-xl bg-muted/40 border text-[15px] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] focus-visible:border-primary/40 ${isPasswordValid ? "border-emerald-500/40" : "border-border/50"}`}
                        required
                        minLength={6}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                        {showPassword ? <EyeSlash className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                    {password && <PasswordStrength password={password} />}
                  </div>

                  <div>
                    <Label className="text-[13px] font-semibold text-foreground">Telefone (WhatsApp)</Label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/50" weight="fill" />
                      <Input
                        ref={phoneRef}
                        value={phone}
                        onChange={e => setPhone(formatMask(e.target.value, 'phone'))}
                        placeholder="(11) 99999-9999"
                        autoComplete="tel"
                        className={`pl-11 pr-10 font-mono h-12 rounded-xl bg-muted/40 border text-[15px] tracking-wide focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] focus-visible:border-primary/40 ${isPhoneValid ? "border-emerald-500/40" : "border-border/50"}`}
                        maxLength={15}
                      />
                      {isPhoneValid && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-emerald-500 pointer-events-none" weight="fill" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">Para lembretes de consulta via WhatsApp</p>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Resumo + Termos + Confirmar */}
              {signupStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  {/* Summary card — premium */}
                  <div className="bg-gradient-to-br from-primary/[0.04] to-secondary/[0.04] rounded-2xl p-5 border border-border/40 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-primary" weight="fill" />
                      </div>
                      <p className="text-xs font-bold text-foreground uppercase tracking-wider">Resumo do cadastro</p>
                    </div>
                    <div className="space-y-2 text-sm pt-1">
                      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30">
                        <span className="text-muted-foreground text-xs">Nome</span>
                        <span className="font-semibold text-foreground truncate">{firstName} {lastName}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30">
                        <span className="text-muted-foreground text-xs">Email</span>
                        <span className="font-semibold text-foreground truncate text-[13px]">{email}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30">
                        <span className="text-muted-foreground text-xs">Telefone</span>
                        <span className="font-semibold text-foreground font-mono text-[13px]">{phone}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-1.5">
                        <span className="text-muted-foreground text-xs">CPF</span>
                        <span className="font-semibold text-foreground font-mono text-[13px]">{cpf}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSignupStep(1)}
                      className="text-xs font-semibold text-primary hover:underline pt-1"
                    >
                      ← Editar dados
                    </button>
                  </div>

                  <TermsConsentCheckbox checked={termsAccepted} onCheckedChange={setTermsAccepted} />

                  {/* Trust mini-row */}
                  <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-xl p-3 border border-border/30">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" weight="fill" />
                    <span className="leading-relaxed">Seus dados são criptografados e protegidos pela LGPD. Nunca compartilhamos com terceiros.</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="w-full h-[54px] rounded-2xl bg-gradient-to-r from-primary to-primary/85 text-primary-foreground font-bold text-base shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              size="lg"
              disabled={
                loading ||
                (signupStep === 1 && !isStep1Valid) ||
                (signupStep === 2 && !isStep2Valid) ||
                (signupStep === 3 && !termsAccepted)
              }
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <SpinnerGap className="w-5 h-5 animate-spin" /> Criando sua conta...
                </span>
              ) : signupStep < 3 ? (
                <span className="flex items-center gap-2">
                  Continuar
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" weight="fill" />
                  Criar minha conta
                </span>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <button type="button" onClick={() => setMode("login")} className="text-primary font-bold hover:underline">
                Entrar
              </button>
            </p>
          </form>
          </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <SEOHead title="AloClínica — Paciente" description="Acesse sua conta AloClinica para consultas médicas online." />

      {/* Desktop left panel */}
      <LeftPanel />

      {/* Mobile hero — inline to avoid remount */}
      <div className="lg:hidden relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-4 rounded-b-3xl shadow-lg shadow-primary/15">
        <div className="absolute top-[-30%] right-[-15%] w-[300px] h-[300px] rounded-full bg-white/[0.1] blur-[80px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[200px] h-[200px] rounded-full bg-secondary/30 blur-[60px]" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5 mb-2">
            <img src={logo} alt="AloClínica" className="w-9 h-9 rounded-xl ring-2 ring-white/30 shadow-lg" />
            <h1 className="text-lg font-black text-white tracking-tight">AloClínica</h1>
          </div>
          
          <motion.img
            src={mascotWave}
            alt=""
            aria-hidden="true"
            className="w-16 h-16 object-contain select-none"
            style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,50,.3))" }}
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          
          <h2 className="sr-only">
            Sua saúde em <br /> boas mãos
          </h2>
          <p className="text-white/70 text-xs mt-1 font-medium">
            Telemedicina 24h sem filas
          </p>
        </div>

        {mode !== "welcome" && (
          <button
            type="button"
            onClick={() => mode === "signup" && signupStep > 1 ? setSignupStep(s => s - 1) : setMode("welcome")}
            className="absolute top-[max(env(safe-area-inset-top),0.75rem)] left-2 w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" weight="bold" />
          </button>
        )}
        
        <Link
          to="/"
          className="absolute top-[max(env(safe-area-inset-top),0.75rem)] right-2 w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Voltar ao início"
        >
          <SignIn className="w-5 h-5" weight="bold" />
        </Link>
      </div>

      {/* Right / main form area */}
      <div className="flex-1 flex flex-col items-center justify-start lg:justify-center px-4 sm:px-5 py-5 sm:py-7 lg:px-10 lg:py-12 xl:px-16 overflow-y-auto">
        <div className="w-full max-w-md">
          {formContent}

          <p className="text-center text-[10px] text-muted-foreground/40 mt-8">
            © {new Date().getFullYear()} AloClínica — Tecnologia em Saúde
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPaciente;
