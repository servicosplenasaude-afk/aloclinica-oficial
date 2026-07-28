import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Building2, Users, Pill, FlaskConical, MessageCircle, Inbox,
  UserCog, ShieldCheck, CheckCircle2, ChevronRight, ArrowRight, Trophy, Sparkles,
} from "lucide-react";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";

/**
 * RoleOnboarding — checklist de primeiros passos para clinic, support e partner.
 *
 * Reusa o padrão do DoctorOnboarding (banner com progresso + próximos passos)
 * mas parametrizado por role. Cada step tem `check(data)` que decide se está
 * concluído com base nos dados carregados do Supabase.
 *
 * Dismiss persiste em localStorage por role; ao atingir 100% mostra estado
 * "perfil completo" e oculta após dismiss.
 */

type Role = "clinic" | "support" | "partner";

type Step = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  path: string;
  check: (d: any) => boolean;
};

const CONFIG: Record<Role, { title: string; emoji: string; steps: Step[]; loader: (userId: string) => Promise<any> }> = {
  clinic: {
    title: "Configure sua clínica",
    emoji: "🏥",
    steps: [
      { id: "cnpj", label: "Cadastrar CNPJ", description: "Identificação fiscal da clínica", icon: Building2, path: "/dashboard/profile?role=clinic", check: (d) => !!d.clinic?.cnpj },
      { id: "address", label: "Adicionar endereço", description: "Endereço completo e telefone", icon: Building2, path: "/dashboard/profile?role=clinic", check: (d) => !!d.clinic?.address && !!d.clinic?.phone },
      { id: "doctors", label: "Vincular primeiro médico", description: "Adicione médicos à clínica", icon: Users, path: "/dashboard/clinic/doctors?role=clinic", check: (d) => (d.doctorCount ?? 0) > 0 },
    ],
    loader: async (userId) => {
      const { data: clinic } = await db.from("clinic_profiles").select("id, cnpj, address, phone").eq("user_id", userId).single();
      if (!clinic) return { clinic: null, doctorCount: 0 };
      const { count } = await db.from("clinic_affiliations").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id).eq("status", "active");
      return { clinic, doctorCount: count ?? 0 };
    },
  },
  support: {
    title: "Pronto para atender",
    emoji: "🎧",
    steps: [
      { id: "profile", label: "Completar perfil", description: "Foto e nome para os usuários", icon: UserCog, path: "/dashboard/profile?role=support", check: (d) => !!d.profile?.first_name && !!d.profile?.avatar_url },
      { id: "inbox", label: "Acessar Inbox", description: "Veja mensagens dos pacientes", icon: Inbox, path: "/dashboard/support/inbox?role=support", check: (d) => d.visited?.inbox },
      { id: "chat", label: "Testar Chat IA", description: "Familiarize-se com o assistente", icon: MessageCircle, path: "/dashboard/support/chat?role=support", check: (d) => d.visited?.chat },
    ],
    loader: async (userId) => {
      const { data: profile } = await db.from("profiles").select("first_name, last_name, avatar_url").eq("user_id", userId).single();
      const visited = {
        inbox: localStorage.getItem("support_visited_inbox") === "true",
        chat: localStorage.getItem("support_visited_chat") === "true",
      };
      return { profile, visited };
    },
  },
  partner: {
    title: "Ative sua farmácia parceira",
    emoji: "💊",
    steps: [
      { id: "profile", label: "Completar perfil", description: "Nome e dados da farmácia", icon: UserCog, path: "/dashboard/profile?role=partner", check: (d) => !!d.profile?.first_name },
      { id: "validate", label: "Validar primeira receita", description: "Use a busca por código", icon: Pill, path: "/dashboard/partner/validate?role=partner", check: (d) => (d.validationCount ?? 0) > 0 },
      { id: "history", label: "Conhecer o histórico", description: "Acompanhe suas validações", icon: FlaskConical, path: "/dashboard/partner/history?role=partner", check: (d) => d.visited?.history },
    ],
    loader: async (userId) => {
      const { data: profile } = await db.from("profiles").select("first_name").eq("user_id", userId).single();
      const { count } = await db.from("prescription_validations").select("id", { count: "exact", head: true }).eq("validated_by", userId);
      const visited = { history: localStorage.getItem("partner_visited_history") === "true" };
      return { profile, validationCount: count ?? 0, visited };
    },
  },
};

interface Props {
  role: Role;
}

const RoleOnboarding = ({ role }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => localStorage.getItem(`onboarding_dismissed_${role}`) === "true");

  const config = CONFIG[role];

  useEffect(() => {
    if (!user) return;
    config.loader(user.id).then(setData).catch(() => setData({}));
  }, [user, role]);

  if (dismissed || !data) return null;

  const completed = config.steps.filter((s) => s.check(data));
  const pending = config.steps.filter((s) => !s.check(data));
  const pct = Math.round((completed.length / config.steps.length) * 100);
  const next = pending[0];

  const dismiss = () => {
    localStorage.setItem(`onboarding_dismissed_${role}`, "true");
    setDismissed(true);
  };

  if (pct === 100) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-5">
        <Card className="border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-primary/5 overflow-hidden">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-foreground">Tudo pronto! {config.emoji}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sua configuração inicial está completa.</p>
            </div>
            <Button size="sm" variant="ghost" className="text-xs" onClick={dismiss}>Fechar</Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-foreground">{config.title} {config.emoji}</p>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{pct}%</Badge>
            </div>
            <Button variant="ghost" size="sm" className="text-[10px] text-muted-foreground h-6" onClick={dismiss}>
              Fechar
            </Button>
          </div>

          <Progress value={pct} className="h-1.5 mb-4" />

          {next && (
            <button
              onClick={() => navigate(next.path)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-all mb-3 text-left active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <next.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-primary">Próximo passo</p>
                <p className="text-sm font-semibold text-foreground">{next.label}</p>
                <p className="text-[10px] text-muted-foreground">{next.description}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-primary shrink-0" />
            </button>
          )}

          <div className="space-y-1">
            {config.steps.map((step) => {
              const done = step.check(data);
              if (step.id === next?.id) return null;
              return (
                <button
                  key={step.id}
                  onClick={() => { if (!done) navigate(step.path); }}
                  disabled={done}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all ${
                    done
                      ? "bg-emerald-500/5 border border-emerald-500/15 opacity-70"
                      : "bg-card border border-border/40 hover:border-primary/30 hover:bg-primary/5 cursor-pointer"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${done ? "bg-emerald-500/15" : "bg-muted/60"}`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <step.icon className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-semibold ${done ? "text-emerald-600 line-through" : "text-foreground"}`}>{step.label}</p>
                  </div>
                  {!done && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default RoleOnboarding;
