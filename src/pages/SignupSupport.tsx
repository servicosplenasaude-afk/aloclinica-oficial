/**
 * SignupSupport — Cadastro de equipe de suporte com layout split-screen unificado.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Mail, Lock, User as UserIcon, Headphones, ArrowRight, ShieldCheck,
  Sparkles, MessageCircle, Inbox,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import {
  AuthField, AuthPasswordField, AuthSubmitButton, AuthHeading,
} from "@/components/auth/AuthFields";
import { CPFInput, PhoneInput } from "@/components/ui/masked-inputs";
import {
  validarNome, validarEmail, validarTelefone, validarCPF, validarSenha,
} from "@/lib/form-validators";
import { toastError } from "@/lib/errorMessages";
import pingoSupport from "@/assets/states/pingo-cadastro-suporte.webp";

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  password: string;
  password_confirm: string;
}

const initial: FormData = {
  full_name: "", email: "", phone: "", cpf: "", password: "", password_confirm: "",
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

export default function SignupSupport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FormData>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => {
    setData((p) => ({ ...p, [k]: v }));
    if (errors[k as string]) setErrors((p) => ({ ...p, [k as string]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!validarNome(data.full_name)) e.full_name = "Informe nome e sobrenome";
    if (!validarEmail(data.email)) e.email = "Email inválido";
    if (!validarTelefone(data.phone)) e.phone = "Telefone inválido";
    if (!validarCPF(data.cpf)) e.cpf = "CPF inválido";
    const pv = validarSenha(data.password);
    if (!pv.isValid) e.password = pv.feedback.join(", ");
    if (data.password !== data.password_confirm) e.password_confirm = "Senhas não conferem";
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
      const parts = data.full_name.trim().split(/\s+/);
      const { data: auth, error } = await db.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            role: "support",
            first_name: parts[0] || "",
            last_name: parts.slice(1).join(" ") || "",
            cpf: data.cpf.replace(/\D/g, ""),
            phone: data.phone.replace(/\D/g, ""),
          },
        },
      });
      if (error) throw error;
      if (!auth.user) throw new Error("Falha ao criar usuário");

      if (!auth.session) {
        await db.auth.signInWithPassword({ email: data.email, password: data.password });
      }
      toast.success("Cadastro realizado com sucesso!");
      navigate("/suporte");
    } catch (err) {
      toastError(toast, err, "signup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      seoTitle="Criar conta — Suporte | AloClínica"
      seoDescription="Cadastre-se como agente de suporte da AloClínica."
      icon={Headphones}
      eyebrow="Equipe de suporte"
      headline="Atendimento que cuida de cada paciente."
      highlightWord="cada paciente"
      description="Resolva tickets, acompanhe pacientes e fortaleça a experiência da AloClínica em tempo real."
      mascotSrc={pingoSupport}
      theme={{
        panelGradient: "from-[hsl(168,55%,28%)] via-[hsl(190,55%,32%)] to-[hsl(215,65%,32%)]",
        benefits: [
          { icon: Inbox, title: "Inbox inteligente", desc: "Tickets priorizados por SLA e severidade." },
          { icon: MessageCircle, title: "Chat em tempo real", desc: "Converse com pacientes e médicos." },
          { icon: ShieldCheck, title: "Acesso restrito", desc: "Trilhas de auditoria e controle por papel." },
        ],
      }}
      footerItems={[
        { icon: ShieldCheck, label: "Acesso auditado", tone: "success" },
        { icon: Sparkles, label: "Suporte 24h" },
      ]}
    >
      <AuthHeading title="Criar conta" subtitle="Preencha seus dados de agente" />

      <form onSubmit={submit} className="space-y-4" noValidate>
        <AuthField
          label="Nome completo"
          icon={UserIcon}
          value={data.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          placeholder="Nome Sobrenome"
          autoComplete="name"
          required
          hint={errors.full_name && <p className="text-[12px] text-destructive">{errors.full_name}</p>}
        />

        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          value={data.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="voce@aloclinica.com"
          autoComplete="email"
          required
          hint={errors.email && <p className="text-[12px] text-destructive">{errors.email}</p>}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <PhoneInput value={data.phone} onChange={(v) => set("phone", v)} required error={errors.phone} />
          <CPFInput value={data.cpf} onChange={(v) => set("cpf", v)} required error={errors.cpf} />
        </div>

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

        <AuthSubmitButton
          loading={loading}
          loadingLabel="Criando conta..."
          icon={<ArrowRight className="w-4 h-4" />}
          variantClassName="bg-gradient-to-r from-secondary via-secondary/90 to-primary text-primary-foreground shadow-lg shadow-secondary/25 hover:shadow-xl hover:brightness-110"
        >
          Criar minha conta
        </AuthSubmitButton>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-center text-[13px] text-muted-foreground pt-1"
        >
          Já tem conta?{" "}
          <Link to="/suporte" className="font-bold text-primary hover:underline">
            Fazer login
          </Link>
        </motion.p>
      </form>
    </AuthShell>
  );
}
