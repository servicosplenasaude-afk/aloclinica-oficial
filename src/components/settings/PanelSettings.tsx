import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Globe, Shield, Loader2, Pencil, ChevronRight, Info, LogOut, Sparkles, ArrowLeft } from "lucide-react";
import { getDoctorNav } from "@/components/doctor/doctorNav";
import { getPatientNav } from "@/components/patient/patientNav";
import { getAdminNav } from "@/components/admin/adminNav";
import { getReceptionNav } from "@/components/reception/receptionNav";
import { toast } from "sonner";
import { motion } from "framer-motion";
import mascotWave from "@/assets/states/pingo-configuracoes.webp";

const roleLabels: Record<string, string> = {
  patient: "Paciente", doctor: "Médico", admin: "Administração",
  receptionist: "Recepção", support: "Suporte", clinic: "Clínica", partner: "Parceiro",
};

function getNavForRole(role: string) {
  switch (role) {
    case "doctor": return getDoctorNav("settings");
    case "patient": return getPatientNav("settings");
    case "admin": return getAdminNav("settings");
    case "receptionist": return getReceptionNav("settings");
    default: return [];
  }
}

type SettingsState = Record<string, any>;

const defaultSettings: Record<string, SettingsState> = {
  patient: {
    reminder_whatsapp: true, reminder_email: true, push_notifications: true, med_alerts: false,
    share_history: true, allow_exam_access: true, language: "Português", timezone: "America/Sao_Paulo",
  },
  doctor: {
    default_duration: "30 min", accept_urgent: false, auto_confirm: true,
    notify_new_appt: true, notify_cancel: true, notify_message: true, sound_alert: true,
    use_memed: true, auto_cid: false, public_profile: true, show_ratings: true,
  },
  admin: {
    maintenance_mode: false, open_registration: true, auto_approve_doctors: false,
    notify_new_doctor: true, notify_new_clinic: true, notify_payments: true, weekly_reports: true,
    require_2fa: false, detailed_logs: true, session_timeout: "4 horas",
  },
  receptionist: {
    auto_checkin: true, notify_doctor_checkin: true, sound_alert: true, notify_cancel: true,
    print_checkin: false, print_receipts: false,
  },
};

interface SettingItem { key: string; label: string; desc?: string; type: "toggle" | "select"; options?: string[]; icon?: typeof Bell }
interface SettingGroup { title: string; icon: typeof Bell; items: SettingItem[] }

const patientGroups: SettingGroup[] = [
  {
    title: "Preferências", icon: Bell, items: [
      { key: "reminder_whatsapp", label: "Notificações", desc: "Alertas, lembretes de consultas", type: "toggle", icon: Bell },
      { key: "push_notifications", label: "Notificações Push", desc: "Avisos em tempo real", type: "toggle", icon: Bell },
      { key: "language", label: "Idioma", desc: "Português (Brasil)", type: "select", options: ["Português (Brasil)", "English", "Español"], icon: Globe },
    ],
  },
  {
    title: "Segurança & Privacidade", icon: Shield, items: [
      { key: "share_history", label: "Segurança", desc: "Biometria e Senha de Acesso", type: "toggle", icon: Shield },
      { key: "allow_exam_access", label: "Privacidade", desc: "Compartilhamento de dados médicos", type: "toggle", icon: Shield },
    ],
  },
  {
    title: "Informações", icon: Info, items: [],
  },
];

// Role-specific groups. Previously EVERY role fell back to patientGroups, so a
// doctor/admin/recepção saw patient-only toggles ("compartilhar histórico
// médico" etc.). Each role now sees only its own preferences.
const doctorGroups: SettingGroup[] = [
  {
    title: "Atendimento", icon: Bell, items: [
      { key: "accept_urgent", label: "Aceitar urgências", desc: "Receber chamados de plantão/urgência", type: "toggle", icon: Bell },
      { key: "auto_confirm", label: "Confirmação automática", desc: "Confirmar novas consultas sem revisar", type: "toggle", icon: Bell },
    ],
  },
  {
    title: "Notificações", icon: Bell, items: [
      { key: "notify_new_appt", label: "Novas consultas", desc: "Avisar quando um paciente agendar", type: "toggle", icon: Bell },
      { key: "notify_cancel", label: "Cancelamentos", desc: "Avisar quando um paciente cancelar", type: "toggle", icon: Bell },
      { key: "notify_message", label: "Mensagens", desc: "Avisar sobre novas mensagens", type: "toggle", icon: Bell },
      { key: "sound_alert", label: "Alerta sonoro", desc: "Som ao receber notificações", type: "toggle", icon: Bell },
    ],
  },
  { title: "Informações", icon: Info, items: [] },
];

const adminGroups: SettingGroup[] = [
  {
    title: "Notificações", icon: Bell, items: [
      { key: "notify_new_doctor", label: "Novos médicos", desc: "Avisar sobre novos cadastros de médicos", type: "toggle", icon: Bell },
      { key: "notify_new_clinic", label: "Novas clínicas", desc: "Avisar sobre novos cadastros de clínicas", type: "toggle", icon: Bell },
      { key: "notify_payments", label: "Pagamentos", desc: "Avisar sobre eventos de pagamento", type: "toggle", icon: Bell },
      { key: "weekly_reports", label: "Relatórios semanais", desc: "Receber resumo semanal por e-mail", type: "toggle", icon: Bell },
    ],
  },
  {
    title: "Segurança", icon: Shield, items: [
      { key: "detailed_logs", label: "Logs detalhados", desc: "Registrar ações administrativas", type: "toggle", icon: Shield },
    ],
  },
  { title: "Informações", icon: Info, items: [] },
];

const receptionistGroups: SettingGroup[] = [
  {
    title: "Atendimento", icon: Bell, items: [
      { key: "auto_checkin", label: "Check-in automático", desc: "Confirmar presença ao chegar", type: "toggle", icon: Bell },
      { key: "notify_doctor_checkin", label: "Avisar médico", desc: "Notificar o médico no check-in", type: "toggle", icon: Bell },
      { key: "notify_cancel", label: "Cancelamentos", desc: "Avisar sobre cancelamentos", type: "toggle", icon: Bell },
      { key: "sound_alert", label: "Alerta sonoro", desc: "Som ao receber notificações", type: "toggle", icon: Bell },
    ],
  },
  { title: "Informações", icon: Info, items: [] },
];

const genericGroups: SettingGroup[] = [
  {
    title: "Notificações", icon: Bell, items: [
      { key: "notify_email", label: "E-mail", desc: "Receber avisos por e-mail", type: "toggle", icon: Bell },
      { key: "notify_push", label: "Push", desc: "Avisos em tempo real", type: "toggle", icon: Bell },
    ],
  },
  { title: "Informações", icon: Info, items: [] },
];

const groupsByRole: Record<string, SettingGroup[]> = {
  patient: patientGroups,
  doctor: doctorGroups,
  admin: adminGroups,
  receptionist: receptionistGroups,
};

const PanelSettings = () => {
  const { user, profile, roles } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const forceRole = searchParams.get("role");
  const isAdmin = roles.includes("admin");
  const activeRole = isAdmin && forceRole ? forceRole
    : roles.includes("doctor") ? "doctor"
    : roles.includes("receptionist") ? "receptionist"
    : roles.includes("support") ? "support"
    : roles.includes("clinic") ? "clinic"
    : roles.includes("partner") ? "partner"
    : "patient";

  const nav = getNavForRole(activeRole);

  const [settings, setSettings] = useState<SettingsState>(defaultSettings[activeRole] ?? { notify_email: true, notify_push: true, language: "Português" });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoadingSettings(true);
      const { data } = await db.from("profiles").select("settings").eq("user_id", user.id).maybeSingle();
      if (data?.settings && typeof data.settings === "object") {
        const saved = (data.settings as Record<string, any>)[activeRole];
        if (saved && typeof saved === "object") setSettings(prev => ({ ...prev, ...saved }));
      }
      setLoadingSettings(false);
    };
    load();
  }, [user, activeRole]);

  const handleChange = useCallback((key: string, val: boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { data: existing } = await db.from("profiles").select("settings").eq("user_id", user.id).maybeSingle();
    const allSettings = (existing?.settings && typeof existing.settings === "object") ? { ...(existing.settings as Record<string, any>) } : {};
    allSettings[activeRole] = settings;
    const { error } = await db.from("profiles").update({ settings: allSettings } as any).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success("Configurações salvas!");
  };

  const handleLogout = async () => {
    await db.auth.signOut();
    navigate("/");
  };

  const initials = `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase();
  const groups = groupsByRole[activeRole] ?? genericGroups;
  const enabledCount = Object.values(settings).filter(value => value === true).length;
  const accountName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Perfil";

  return (
    <DashboardLayout title={roleLabels[activeRole] ?? "Configurações"} nav={nav} role={activeRole}>
      <div className="w-full mx-auto max-w-5xl pb-24 md:pb-6">
        <button onClick={() => navigate(`/dashboard?role=${activeRole}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        {/* Profile Header */}
        <div className="relative mb-6 overflow-hidden rounded-[32px] border border-white/60 bg-[linear-gradient(135deg,#eef7ff_0%,#ffffff_52%,#fff4f7_100%)] p-5 text-center shadow-[0_24px_70px_-46px_rgba(15,42,90,.68)] md:p-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/16 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-16 h-40 w-40 rounded-full bg-rose-300/14 blur-3xl" />
          <div className="relative flex flex-col items-center">
          <div className="relative mb-4">
            <Avatar className="w-[88px] h-[88px] border-4 border-white shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => navigate(`/dashboard/profile?role=${activeRole}`)}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity active:scale-95"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
          <h1 className="text-xl font-extrabold text-foreground font-[Manrope]">Configurações</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie suas preferências e segurança</p>
        </div>

          <div className="mt-5 grid w-full grid-cols-3 gap-2">
            {[
              { label: "Ativas", value: enabledCount },
              { label: "Perfil", value: roleLabels[activeRole] ?? activeRole },
              { label: "Idioma", value: String(settings.language ?? "PT").replace(" (Brasil)", "") },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-white/65 bg-white/72 p-3 text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                <p className="mt-1 truncate text-sm font-black text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {loadingSettings ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6">
            {groups.map((group, gi) => (
              <div key={group.title}>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary mb-3 px-1">{group.title}</p>
                <div className="rounded-[28px] bg-card/95 border border-border/35 overflow-hidden divide-y divide-border/10 shadow-sm">
                  {group.items.map((item, ii) => {
                    const ItemIcon = item.icon ?? group.icon;
                    return (
                      <motion.div
                        key={item.key}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (gi * group.items.length + ii) * 0.03 }}
                        className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/25"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-primary/[0.08] flex items-center justify-center shrink-0">
                            <ItemIcon className="w-4.5 h-4.5 text-primary" />
                          </div>
                          <div>
                            <Label className="text-[14px] font-semibold text-foreground cursor-pointer">{item.label}</Label>
                            {item.desc && <p className="text-[12px] text-muted-foreground mt-0.5">{item.desc}</p>}
                          </div>
                        </div>
                        {item.type === "toggle" ? (
                          <Switch checked={settings[item.key] ?? false} onCheckedChange={v => handleChange(item.key, v)} />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                        )}
                      </motion.div>
                    );
                  })}
                  {group.title === "Informações" && (
                    <button className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors text-left">
                      <div className="w-10 h-10 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0">
                        <Info className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-semibold text-foreground">Sobre o App</p>
                        <p className="text-[12px] text-muted-foreground">Versão 2.4.1 (Build 890)</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-destructive/[0.04] border border-destructive/10 hover:bg-destructive/[0.08] transition-colors text-destructive font-semibold text-[14px]"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </button>

            <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-full shadow-[0_4px_16px_hsl(215_75%_32%/0.25)]" size="lg">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar Configurações
            </Button>

            {/* Mascot helper */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-primary/[0.04] border border-primary/10"
            >
              <img src={mascotWave} alt="Pingo" className="w-16 h-16 object-contain shrink-0" loading="lazy" />
              <div className="relative bg-card rounded-2xl rounded-bl-sm px-4 py-3 border border-border/20 shadow-sm">
                <p className="text-[13px] font-medium text-foreground">Precisa de ajuda com o app?</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Fale com nosso suporte a qualquer momento</p>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PanelSettings;
