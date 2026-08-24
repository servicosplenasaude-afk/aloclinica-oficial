/**
 * SignupClinic — Cadastro de clínica/empresa com layout split-screen unificado.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Mail, Lock, Building2, User as UserIcon, ArrowRight,
  ShieldCheck, Sparkles, Users, ChartLine, Briefcase,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import {
  AuthField, AuthPasswordField, AuthSubmitButton, AuthHeading,
} from "@/components/auth/AuthFields";
import { CNPJInput, PhoneInput } from "@/components/ui/masked-inputs";
import {
  validarNomeEmpresa, validarEmail, validarTelefone, validarCNPJ,
  validarSenha, validarNome,
} from "@/lib/form-validators";
import { toastError } from "@/lib/errorMessages";
import pingoClinic from "@/assets/pingo-clinica-medica.jpg";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";

interface FormData {
  company_name: string;
  cnpj: string;
  email: string;
  phone: string;
  representative_name: string;
  password: string;
  password_confirm: string;
}

const initial: FormData = {
  company_name: "", cnpj: "", email: "", phone: "",
  representative_name: "", password: "", password_confirm: "",
};

const PasswordStrength = ({ password }: { password: string }) => {
  if (!password) return null;
  const score =
    (password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
  const labels = ["Fraca", "Razoável", "Boa", "Forte"];
  const colors = ["bg-destructive", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];
  const idx = Math.max(0, score - 1);
  return (
    <div className="space-y-1.5 pt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < score ? colors[idx] : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Força da senha: <span className="font-semibold text-foreground">{labels[idx]}</span>
      </p>
    </div>
  );
};

export default function SignupClinic() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FormData>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [oauthUserId, setOAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("oauth") !== "complete") return;
    void db.auth.getSession().then(({ data: sessionData }: any) => {
      const user = sessionData?.session?.user;
      if (!user || user.app_metadata?.provider !== "google") return;
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      setOAuthUserId(user.id);
      setData((current) => ({ ...current, email: user.email || current.email, representative_name: fullName || current.representative_name }));
    });
  }, []);

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => {
    setData((p) => ({ ...p, [k]: v }));
    if (errors[k as string]) setErrors((p) => ({ ...p, [k as string]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!validarNomeEmpresa(data.company_name)) e.company_name = "Nome da empresa inválido";
    if (!validarCNPJ(data.cnpj)) e.cnpj = "CNPJ inválido";
    if (!validarEmail(data.email)) e.email = "Email inválido";
    if (!validarTelefone(data.phone)) e.phone = "Telefone inválido";
    if (!validarNome(data.representative_name)) e.representative_name = "Informe nome e sobrenome";
    if (!oauthUserId) {
    const pv = validarSenha(data.password);
    if (!pv.isValid) e.password = pv.feedback.join(", ");
    if (data.password !== data.password_confirm) e.password_confirm = "Senhas não conferem";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }
    setLoading(true);
    try {
      const parts = data.representative_name.trim().split(/\s+/);
      let authedUserId = oauthUserId;
      if (!authedUserId) {
      const { data: auth, error } = await db.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            role: "clinic",
            first_name: parts[0] || "",
            last_name: parts.slice(1).join(" ") || "",
            phone: data.phone.replace(/\D/g, ""),
          },
        },
      });
      if (error) throw error;
      if (!auth.user) throw new Error("Falha ao criar usuário");

      if (!auth.session) {
        await db.auth.signInWithPassword({ email: data.email, password: data.password });
      }

      const { data: sessionData } = await db.auth.getSession();
      authedUserId = sessionData?.session?.user?.id || null;
      if (!authedUserId || authedUserId !== auth.user.id) {
        throw new Error("Sessão não confirmada. Faça login para finalizar o cadastro.");
      }

      }
      if (!authedUserId) throw new Error("Sessão não confirmada");
      const { error: cErr } = await (db as any).from("clinic_profiles").insert({
        user_id: authedUserId,
        name: data.company_name,
        cnpj: data.cnpj.replace(/\D/g, ""),
        phone: data.phone.replace(/\D/g, ""),
        is_approved: false,
      });
      if (cErr && !String(cErr.message || "").includes("duplicate")) throw cErr;

      toast.success("Cadastro realizado! Sua clínica está em análise.");
      navigate("/aguardando-aprovacao?role=clinic");
    } catch (err) {
      toastError(toast, err, "signup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      seoTitle="Criar conta — Clínica | AloClínica"
      seoDescription="Cadastre sua clínica na AloClínica e gerencie agenda, prontuários e equipe em um só lugar."
      icon={Building2}
      eyebrow="Para clínicas"
      headline="Gestão completa para sua clínica."
      highlightWord="completa"
      description="Centralize agenda, prontuários, equipe médica e atendimentos em uma plataforma feita para escalar."
      mascotSrc={pingoClinic}
      theme={{
        panelGradient: "from-[hsl(215,70%,22%)] via-[hsl(218,60%,28%)] to-[hsl(195,55%,35%)]",
        benefits: [
          { icon: Users, title: "Equipe ilimitada", desc: "Gerencie médicos, recepcionistas e financeiro." },
          { icon: ChartLine, title: "Indicadores em tempo real", desc: "Receita, ocupação e satisfação." },
          { icon: ShieldCheck, title: "Conformidade CFM e LGPD", desc: "Prontuário seguro e rastreável." },
        ],
      }}
      footerItems={[
        { icon: ShieldCheck, label: "LGPD", tone: "success" },
        { icon: Briefcase, label: "Onboarding em 24h" },
      ]}
    >
      <AuthHeading title="Cadastrar clínica" subtitle="Vamos preparar seu ambiente em poucos passos" />

      {!oauthUserId && <SocialAuthButtons flow="signup" role="clinic" redirectTo="/clinica/cadastro" showApple={false} />}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <AuthField
          label="Nome da empresa"
          icon={Building2}
          value={data.company_name}
          onChange={(e) => set("company_name", e.target.value)}
          placeholder="Clínica Saúde Total"
          required
          hint={errors.company_name && <p className="text-[12px] text-destructive">{errors.company_name}</p>}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <CNPJInput value={data.cnpj} onChange={(v) => set("cnpj", v)} required error={errors.cnpj} />
          <PhoneInput value={data.phone} onChange={(v) => set("phone", v)} required error={errors.phone} />
        </div>

        <AuthField
          label="Email corporativo"
          icon={Mail}
          type="email"
          value={data.email}
          onChange={(e) => set("email", e.target.value)}
          readOnly={Boolean(oauthUserId)}
          placeholder="contato@clinica.com"
          autoComplete="email"
          required
          hint={errors.email && <p className="text-[12px] text-destructive">{errors.email}</p>}
        />

        <AuthField
          label="Nome do representante"
          icon={UserIcon}
          value={data.representative_name}
          onChange={(e) => set("representative_name", e.target.value)}
          placeholder="Dr. João Silva"
          autoComplete="name"
          required
          hint={errors.representative_name && <p className="text-[12px] text-destructive">{errors.representative_name}</p>}
        />

        {!oauthUserId && <>
        <AuthPasswordField
          label="Senha"
          icon={Lock}
          value={data.password}
          onChange={(e) => set("password", e.target.value)}
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          required
          strength={errors.password
            ? <p className="text-[12px] text-destructive mt-1.5">{errors.password}</p>
            : <PasswordStrength password={data.password} />}
        />

        <AuthPasswordField
          label="Confirmar senha"
          icon={Lock}
          value={data.password_confirm}
          onChange={(e) => set("password_confirm", e.target.value)}
          placeholder="Repita a senha"
          autoComplete="new-password"
          required
          strength={errors.password_confirm && <p className="text-[12px] text-destructive mt-1.5">{errors.password_confirm}</p>}
        />

        </>}

        <AuthSubmitButton
          loading={loading}
          loadingLabel="Criando conta..."
          icon={<ArrowRight className="w-4 h-4" />}
          variantClassName="bg-gradient-to-r from-primary via-primary/90 to-secondary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:brightness-110"
        >
          Cadastrar clínica
        </AuthSubmitButton>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-center text-[13px] text-muted-foreground pt-1"
        >
          Já tem conta?{" "}
          <Link to="/clinica" className="font-bold text-primary hover:underline">
            Fazer login
          </Link>
        </motion.p>
      </form>
    </AuthShell>
  );
}
