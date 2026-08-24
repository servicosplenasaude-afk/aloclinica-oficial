/**
 * SignupPatient — Cadastro de paciente com layout split-screen unificado.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Mail, Lock, User as UserIcon, Calendar, Heart, ShieldCheck,
  Sparkles, Stethoscope, FileText, ArrowRight,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";
import {
  AuthField, AuthPasswordField, AuthSubmitButton, AuthHeading,
} from "@/components/auth/AuthFields";
import { CPFInput, PhoneInput } from "@/components/ui/masked-inputs";
import {
  validarNome, validarEmail, validarTelefone, validarCPF,
  validarSenha, validarDataNascimento,
} from "@/lib/form-validators";
import { toastError } from "@/lib/errorMessages";
import mascotWelcome from "@/assets/states/pingo-cadastro-paciente.webp";
import { suggestEmailFix } from "@/lib/brValidators";
import { Checkbox } from "@/components/ui/checkbox";
import { logConsents } from "@/lib/consent";

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  date_of_birth: string;
  password: string;
  password_confirm: string;
}

const initial: FormData = {
  full_name: "", email: "", phone: "", cpf: "",
  date_of_birth: "", password: "", password_confirm: "",
};

const passwordScore = (pwd: string) =>
  (pwd.length >= 8 ? 1 : 0) +
  (/[A-Z]/.test(pwd) ? 1 : 0) +
  (/[0-9]/.test(pwd) ? 1 : 0) +
  (/[^A-Za-z0-9]/.test(pwd) ? 1 : 0);

const PasswordStrength = ({ password }: { password: string }) => {
  if (!password) return null;
  const score = passwordScore(password);
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

export default function SignupPatient() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FormData>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptLgpd, setAcceptLgpd] = useState(false);
  const [acceptTcle, setAcceptTcle] = useState(false);
  const allConsents = acceptTerms && acceptLgpd && acceptTcle;

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
    if (!data.date_of_birth) e.date_of_birth = "Obrigatório";
    else if (!validarDataNascimento(data.date_of_birth)) e.date_of_birth = "Você deve ter 16 anos ou mais";
    const pv = validarSenha(data.password);
    if (!pv.isValid) e.password = pv.feedback.join(", ");
    if (data.password !== data.password_confirm) e.password_confirm = "Senhas não conferem";
    if (!allConsents) e.consents = "Você precisa aceitar os termos, a política LGPD e o TCLE para continuar";
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
            role: "patient",
            first_name: parts[0] || "",
            last_name: parts.slice(1).join(" ") || "",
            cpf: data.cpf.replace(/\D/g, ""),
            phone: data.phone.replace(/\D/g, ""),
            date_of_birth: data.date_of_birth,
          },
        },
      });
      if (error) throw error;
      if (!auth.user) throw new Error("Falha ao criar usuário");
      // Auto-login (caso confirmação de email esteja desativada)
      if (!auth.session) {
        await db.auth.signInWithPassword({ email: data.email, password: data.password });
      }
      // LGPD audit trail (best-effort, never blocks the flow).
      await logConsents([
        { type: "terms_of_use", userId: auth.user.id, documentUrl: "/terms" },
        { type: "privacy_policy", userId: auth.user.id, documentUrl: "/privacy" },
        { type: "lgpd_data_processing", userId: auth.user.id, documentUrl: "/lgpd" },
        { type: "tcle_telemedicine", userId: auth.user.id, documentUrl: "/terms#5",
          metadata: { resolution: "CFM 2.314/2022", scope: "signup_once" } },
      ]);
      // Programa de indicação: ?ref=CODIGO no signup credita ambas as partes.
      try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get("ref");
        if (ref && auth.user.id) {
          const { data: refRow } = await db.from("referrals").select("id, referrer_user_id").eq("code", ref).maybeSingle();
          if (refRow && (refRow as any).referrer_user_id !== auth.user.id) {
            await db.from("referral_uses").insert({
              referral_id: (refRow as any).id,
              referred_user_id: auth.user.id,
            } as any);
            await db.from("referrals").update({
              usage_count: ((refRow as any).usage_count ?? 0) + 1,
            } as any).eq("id", (refRow as any).id);
            toast.success("Código aplicado! Você ganhou R$ 30 de crédito.");
          }
        }
      } catch { /* não bloqueia o cadastro */ }

      toast.success("Cadastro realizado com sucesso!");
      // Deep-link: ?redirect=/qualquer-rota → segue direto para lá após cadastro
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      navigate(redirect && redirect.startsWith("/") ? redirect : "/dashboard");
    } catch (err) {
      const msg = String((err as any)?.message || err || "");
      const isEmailExists = /already.*registered|user.*already|email_exists|already_exists/i.test(msg);
      if (isEmailExists) {
        toast.error("E-mail já cadastrado", {
          description: "Vamos te levar para o login.",
          action: { label: "Ir para login", onClick: () => navigate(`/paciente?email=${encodeURIComponent(data.email)}`) },
        });
      } else {
        toastError(toast, err, "signup");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      seoTitle="Criar conta — Paciente | AloClínica"
      seoDescription="Cadastre-se na AloClínica e tenha acesso a consultas, receitas e histórico médico em um só lugar."
      icon={Heart}
      eyebrow="Sou paciente"
      headline="Sua saúde começa em poucos minutos."
      highlightWord="poucos minutos"
      description="Consultas online com médicos verificados, receitas digitais válidas e seu histórico sempre à mão."
      mascotSrc={mascotWelcome}
      theme={{
        panelGradient: "from-[hsl(215,75%,28%)] via-[hsl(195,70%,32%)] to-[hsl(168,55%,38%)]",
        benefits: [
          { icon: Stethoscope, title: "Médicos verificados", desc: "CRM ativo e atendimento em até 15 min." },
          { icon: FileText, title: "Receita digital válida", desc: "Assinatura ICP-Brasil aceita em qualquer farmácia." },
          { icon: ShieldCheck, title: "Dados protegidos", desc: "Criptografia ponta a ponta e LGPD." },
        ],
      }}
      footerItems={[
        { icon: ShieldCheck, label: "LGPD", tone: "success" },
        { icon: Sparkles, label: "Cadastro em 2 min" },
      ]}
    >
      <AuthHeading title="Criar conta" subtitle="Preencha seus dados para começar" />

      <SocialAuthButtons flow="signup" role="patient" redirectTo="/dashboard?role=patient" showApple={false} />

      <form onSubmit={submit} className="space-y-4" noValidate>
        <AuthField
          label="Nome completo"
          icon={UserIcon}
          value={data.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          placeholder="Maria Silva Santos"
          autoComplete="name"
          required
          hint={errors.full_name && <p className="text-[12px] text-destructive">{errors.full_name}</p>}
        />

        <div>
          <AuthField
            label="Email"
            icon={Mail}
            type="email"
            value={data.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
            required
            hint={errors.email && <p className="text-[12px] text-destructive">{errors.email}</p>}
          />
          {(() => {
            const fix = suggestEmailFix(data.email);
            if (!fix || errors.email) return null;
            return (
              <button type="button" onClick={() => set("email", fix)}
                className="text-[11px] text-primary hover:underline mt-1 inline-flex items-center gap-1">
                Quis dizer <strong>{fix}</strong>?
              </button>
            );
          })()}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <PhoneInput value={data.phone} onChange={(v) => set("phone", v)} required error={errors.phone} />
          <CPFInput value={data.cpf} onChange={(v) => set("cpf", v)} required error={errors.cpf} />
        </div>

        <AuthField
          label="Data de nascimento"
          icon={Calendar}
          type="date"
          value={data.date_of_birth}
          onChange={(e) => set("date_of_birth", e.target.value)}
          required
          hint={errors.date_of_birth && <p className="text-[12px] text-destructive">{errors.date_of_birth}</p>}
        />

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

        <div className="space-y-2.5 rounded-xl border border-border bg-muted/30 p-3.5">
          <label className="flex items-start gap-2.5 text-[12px] text-muted-foreground cursor-pointer">
            <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} className="mt-0.5" />
            <span>
              Li e aceito os{" "}
              <Link to="/terms" target="_blank" className="text-primary underline">Termos de Uso</Link>{" "}
              e a <Link to="/privacy" target="_blank" className="text-primary underline">Política de Privacidade</Link>.
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-[12px] text-muted-foreground cursor-pointer">
            <Checkbox checked={acceptLgpd} onCheckedChange={(v) => setAcceptLgpd(v === true)} className="mt-0.5" />
            <span>
              Autorizo o tratamento dos meus dados pessoais e de saúde conforme a{" "}
              <Link to="/lgpd" target="_blank" className="text-primary underline">Lei nº 13.709/2018 (LGPD)</Link>,
              para fins de cadastro, agendamento e prontuário eletrônico.
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-[12px] text-muted-foreground cursor-pointer">
            <Checkbox checked={acceptTcle} onCheckedChange={(v) => setAcceptTcle(v === true)} className="mt-0.5" />
            <span>
              Declaro estar ciente e concordar com o{" "}
              <strong className="text-foreground">Termo de Consentimento Livre e Esclarecido (TCLE)</strong>{" "}
              para atendimento por telemedicina, conforme a Resolução CFM nº 2.314/2022.
            </span>
          </label>
          {errors.consents && (
            <p className="text-[11px] text-destructive pt-1">{errors.consents}</p>
          )}
        </div>

        <AuthSubmitButton
          loading={loading}
          disabled={!allConsents}
          loadingLabel="Criando conta..."
          icon={<ArrowRight className="w-4 h-4" />}
          variantClassName="bg-gradient-to-r from-primary via-primary/90 to-secondary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:brightness-110"
        >
          Criar minha conta
        </AuthSubmitButton>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-center text-[13px] text-muted-foreground pt-1"
        >
          Já tem conta?{" "}
          <Link to="/paciente" className="font-bold text-primary hover:underline">
            Fazer login
          </Link>
        </motion.p>
      </form>
    </AuthShell>
  );
}
