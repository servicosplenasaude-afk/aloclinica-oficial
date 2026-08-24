import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, Shield, ShieldCheck, Building2, Hospital, Users, BarChart3,
  ArrowRight, LogIn, Briefcase, FileText, CheckCircle2, type LucideIcon,
} from "lucide-react";
import TermsConsentCheckbox from "@/components/auth/TermsConsentCheckbox";
import { registerConsent } from "@/lib/consent";
import PasswordStrength from "@/components/ui/password-strength";
import pingoReception from "@/assets/states/pingo-acesso-clinica.webp";
import AuthShell from "@/components/auth/AuthShell";
import { AuthField, AuthPasswordField, AuthSubmitButton, AuthHeading } from "@/components/auth/AuthFields";
import { translateAuthError } from "@/lib/authErrors";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";

type Step = "welcome" | "register" | "login";

const benefits: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Hospital, title: "Gestão clínica", desc: "Agenda, equipe e pacientes em um só painel." },
  { icon: Users, title: "Equipe conectada", desc: "Recepção, médicos e gestão num só painel." },
  { icon: BarChart3, title: "Relatórios em tempo real", desc: "SLA, volume e faturamento à mão." },
  { icon: ShieldCheck, title: "Conformidade LGPD", desc: "Dados clínicos criptografados e auditáveis." },
];

const formatCnpj = (v: string) =>
  v.replace(/\D/g, "").slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

const fadeForm = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
};

const AuthClinica = () => {
  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [crm, setCrm] = useState("");
  const [crmState, setCrmState] = useState("SP");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await db.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Erro ao entrar", { description: translateAuthError(error.message) });
    } else {
      navigate("/dashboard?role=clinic");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast.error("Aceite os termos", { description: "Você precisa aceitar os Termos de Uso." });
      return;
    }
    if (cnpj.replace(/\D/g, "").length !== 14) {
      toast.error("CNPJ inválido", { description: "Informe um CNPJ válido com 14 dígitos." });
      return;
    }
    setLoading(true);
    const { data, error } = await db.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { business_name: razaoSocial, responsible_name: responsavel },
      },
    });
    if (error) {
      setLoading(false);
      toast.error("Erro no cadastro", { description: translateAuthError(error.message) });
      return;
    }
    if (data.user) {
      await db.functions.invoke("assign-role", {
        body: {
          user_id: data.user.id,
          role: "clinic",
          profile_data: {
            name: razaoSocial,
            cnpj: cnpj.replace(/\D/g, ""),
            responsible_name: responsavel,
            responsible_crm: crm,
            responsible_crm_state: crmState,
          },
        },
      });
      await registerConsent(data.user.id, "terms_and_privacy_clinic");
    }
    setLoading(false);
    toast.success("Cadastro realizado!", { description: "Bem-vinda ao portal da sua clínica." });
    navigate("/dashboard?role=clinic");
  };

  const headings: Record<Step, { title: string; subtitle: string }> = {
    welcome: { title: "Portal da Clínica", subtitle: "Como deseja começar hoje?" },
    register: { title: "Cadastrar clínica", subtitle: "Preencha os dados institucionais" },
    login: { title: "Acessar portal", subtitle: "Entre com sua conta corporativa" },
  };

  return (
    <AuthShell
      seoTitle="Portal da Clínica — AloClínica"
      seoDescription="Gerencie sua clínica, exames e equipe com a AloClínica."
      icon={Building2}
      eyebrow="Portal Institucional"
      headline="Sua clínica conectada à medicina digital"
      highlightWord="medicina digital"
      description="Gerencie equipe, agenda e pacientes com relatórios completos. Plataforma segura e certificada."
      mascotSrc={pingoReception}
      theme={{
        panelGradient: "from-[hsl(220,55%,14%)] via-[hsl(222,50%,18%)] to-[hsl(225,45%,22%)]",
        benefits,
      }}
      footerItems={[
        { icon: ShieldCheck, label: "LGPD" },
        { icon: Building2, label: "Portal institucional" },
      ]}
    >
      <AuthHeading title={headings[step].title} subtitle={headings[step].subtitle} />

      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <motion.div key="welcome" {...fadeForm} className="space-y-3">
            <button
              onClick={() => setStep("register")}
              className="w-full p-5 rounded-2xl border border-border bg-card hover:border-[hsl(220,55%,40%)] hover:shadow-lg text-left transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(220,55%,22%)] to-[hsl(225,50%,30%)] flex items-center justify-center shadow-md">
                  <Briefcase className="w-6 h-6 text-[hsl(42,85%,65%)]" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">Cadastrar minha clínica</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Criar uma conta institucional</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </div>
            </button>
            <button
              onClick={() => setStep("login")}
              className="w-full p-5 rounded-2xl border border-border bg-card hover:border-[hsl(42,85%,55%)] hover:shadow-lg text-left transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[hsl(42,85%,95%)] dark:bg-[hsl(42,30%,18%)] flex items-center justify-center">
                  <LogIn className="w-6 h-6 text-[hsl(38,85%,40%)] dark:text-[hsl(42,85%,60%)]" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">Já tenho conta</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Acessar o painel da clínica</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </div>
            </button>
          </motion.div>
        )}

        {step === "register" && (
          <motion.form key="register" onSubmit={handleRegister} {...fadeForm} className="space-y-4" noValidate>
            <AuthField
              label="Razão social"
              icon={Hospital}
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Clínica Exemplo Ltda"
              autoComplete="organization"
              required
            />
            <AuthField
              label="CNPJ"
              icon={FileText}
              value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              required
            />
            <AuthField
              label="Responsável técnico"
              icon={Users}
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Dr(a). Nome completo"
              autoComplete="name"
              required
            />
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div>
                <Label htmlFor="crm" className="text-[13.5px] font-semibold text-foreground">
                  CRM do responsável
                </Label>
                <Input
                  id="crm"
                  required
                  value={crm}
                  onChange={(e) => setCrm(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  className="h-[52px] rounded-2xl mt-1.5 bg-card border-border/60"
                />
              </div>
              <div>
                <Label htmlFor="uf" className="text-[13.5px] font-semibold text-foreground">UF</Label>
                <Input
                  id="uf"
                  value={crmState}
                  onChange={(e) => setCrmState(e.target.value.toUpperCase().slice(0, 2))}
                  className="h-[52px] rounded-2xl mt-1.5 text-center font-bold tracking-wider bg-card border-border/60"
                  required
                />
              </div>
            </div>
            <AuthField
              label="Email corporativo"
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@suaclinica.com"
              autoComplete="email"
              required
            />
            <AuthPasswordField
              label="Senha"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              minLength={6}
              required
              strength={password ? <PasswordStrength password={password} /> : null}
            />
            <TermsConsentCheckbox checked={termsAccepted} onCheckedChange={setTermsAccepted} />
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 h-[52px] rounded-2xl"
                onClick={() => setStep("welcome")}
              >
                Voltar
              </Button>
              <AuthSubmitButton
                loading={loading}
                loadingLabel="Criando..."
                disabled={!termsAccepted}
                icon={<ArrowRight className="w-4 h-4" />}
                variantClassName="bg-gradient-to-r from-[hsl(220,55%,22%)] to-[hsl(225,50%,32%)] text-white shadow-lg hover:brightness-110"
                className="flex-1"
              >
                Criar conta
              </AuthSubmitButton>
            </div>
            <p className="text-[12.5px] text-center text-muted-foreground">
              Já possui cadastro?{" "}
              <button
                type="button"
                onClick={() => setStep("login")}
                className="font-bold text-[hsl(220,55%,35%)] dark:text-[hsl(220,75%,70%)] hover:underline"
              >
                Entrar
              </button>
            </p>
          </motion.form>
        )}

        {step === "login" && (
          <motion.form key="login" onSubmit={handleLogin} {...fadeForm} className="space-y-5" noValidate>
            <AuthField
              label="Email corporativo"
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@suaclinica.com"
              autoComplete="email"
              required
            />
            <AuthPasswordField
              label="Senha"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              showForgot
              required
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 h-[52px] rounded-2xl"
                onClick={() => setStep("welcome")}
              >
                Voltar
              </Button>
              <AuthSubmitButton
                loading={loading}
                loadingLabel="Entrando..."
                icon={<LogIn className="w-4 h-4" />}
                variantClassName="bg-gradient-to-r from-[hsl(220,55%,22%)] to-[hsl(225,50%,32%)] text-white shadow-lg hover:brightness-110"
                className="flex-1"
              >
                Entrar
              </AuthSubmitButton>
            </div>
            <SocialAuthButtons flow="login" role="clinic" redirectTo="/dashboard?role=clinic" showApple={false} />
            <div className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground pt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(42,85%,45%)]" aria-hidden="true" />
              Conexão segura e conformidade LGPD
            </div>
            <p className="text-[12.5px] text-center text-muted-foreground">
              Nova clínica?{" "}
              <button
                type="button"
                onClick={() => setStep("register")}
                className="font-bold text-[hsl(220,55%,35%)] dark:text-[hsl(220,75%,70%)] hover:underline"
              >
                Cadastrar agora
              </button>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthShell>
  );
};

export default AuthClinica;
