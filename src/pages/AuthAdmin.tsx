import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import { toast } from "sonner";
import {
  Mail, Lock, Shield, ShieldCheck, BarChart3, Building2, Users,
  ScrollText, type LucideIcon,
} from "lucide-react";
import pingoAdmin from "@/assets/states/pingo-acesso-admin.webp";
import AuthShell from "@/components/auth/AuthShell";
import { AuthField, AuthPasswordField, AuthSubmitButton, AuthHeading } from "@/components/auth/AuthFields";
import { translateAuthError } from "@/lib/authErrors";
import { reportFailedLogin } from "@/lib/security";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

const benefits: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: BarChart3, title: "Dashboard financeiro", desc: "Faturamento, MRR e relatórios em tempo real." },
  { icon: Users, title: "Gestão de usuários", desc: "Aprove médicos, clínicas e parceiros." },
  { icon: ScrollText, title: "Auditoria completa", desc: "Logs de ações e conformidade LGPD." },
  { icon: ShieldCheck, title: "Segurança 2FA", desc: "Autenticação reforçada e RLS rigorosa." },
];

const AuthAdmin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { redirectAfterLogin } = useAuthRedirect();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      reportFailedLogin(email, "admin_login");
      toast.error("Erro ao entrar", { description: translateAuthError(error.message) });
    } else if (data.user) {
      await redirectAfterLogin(data.user.id);
    } else {
      navigate("/dashboard?role=admin");
    }
  };

  return (
    <AuthShell
      seoTitle="Acesso Administrativo — AloClínica"
      seoDescription="Painel administrativo da AloClínica. Acesso restrito."
      icon={Shield}
      eyebrow="Painel Administrativo"
      headline="Centro de comando da plataforma"
      highlightWord="comando"
      description="Acesso restrito. Gerencie faturamento, cadastros, planos e relatórios em tempo real."
      mascotSrc={pingoAdmin}
      theme={{
        panelGradient: "from-[hsl(220,40%,8%)] via-[hsl(222,42%,12%)] to-[hsl(225,45%,16%)]",
        benefits,
      }}
      footerItems={[
        { icon: ShieldCheck, label: "Acesso restrito" },
        { icon: Lock, label: "Criptografado" },
        { icon: Shield, label: "2FA obrigatório", tone: "danger" },
      ]}
    >
      <AuthHeading
        title="Acesso Administrativo"
        subtitle="Use suas credenciais corporativas"
      />

      <form onSubmit={handleLogin} className="space-y-5" noValidate>
        <AuthField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@aloclinica.com"
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
          variantClassName="bg-gradient-to-r from-foreground to-foreground/85 text-background shadow-lg hover:shadow-xl hover:brightness-110"
        >
          Entrar como Admin
        </AuthSubmitButton>
      </form>

      <p className="text-[12px] text-center text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
        <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
        Área exclusiva da equipe AloClínica
      </p>
    </AuthShell>
  );
};

export default AuthAdmin;
