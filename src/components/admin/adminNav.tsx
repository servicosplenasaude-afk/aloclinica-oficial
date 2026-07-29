import {
  SquaresFour, VideoCamera, Wallet, ChartLineUp, Star,
  UserCircleCheck, ClipboardText, UserGear, Users, Stethoscope,
  Buildings, CalendarCheck, ShieldStar, Megaphone,
   Key, Tag, ClockCounterClockwise, WhatsappLogo, Sliders, Pulse,
    PaintBrush, Image as ImageIcon, Heart, CreditCard
    , TestTube, Handshake, Layout, Browser, Shield, Graph,
    Database, FileText, DeviceMobile,
    IdentificationCard, EnvelopeSimple, ShieldWarning,
    Gauge, Funnel, ArrowsClockwise
 } from "@phosphor-icons/react";
import { NavIcon } from "@/components/ui/nav-icon";

/**
 * Admin sidebar navigation
 * 5 grupos coesos · ordem por frequência de uso · sem itens órfãos
 */
export const getAdminNav = (active: string) => [
  // ── Visão Geral ──
   { label: "Centro de Controle", href: "/dashboard/admin/panel-center?role=admin", icon: <NavIcon icon={<SquaresFour size={16} weight="fill" />}    color="blue"   />, active: active === "overview" || active === "panel-center", group: "Visão Geral" },
   { label: "Monitor ao Vivo",  href: "/dashboard/admin/live?role=admin",         icon: <NavIcon icon={<VideoCamera size={16} weight="fill" />}    color="rose"   />, active: active === "live",     group: "Visão Geral" },
   { label: "Relatórios",      href: "/dashboard/admin/reports?role=admin",      icon: <NavIcon icon={<Graph size={16} weight="fill" />}          color="emerald" />, active: active === "reports",  group: "Visão Geral" },
   { label: "Retenção",        href: "/dashboard/admin/retention?role=admin",    icon: <NavIcon icon={<ArrowsClockwise size={16} weight="fill" />} color="purple"  />, active: active === "retention", group: "Visão Geral" },
   { label: "NPS & Satisfação", href: "/dashboard/admin/nps?role=admin",         icon: <NavIcon icon={<Star size={16} weight="fill" />}           color="amber"   />, active: active === "nps",      group: "Visão Geral" },
   { label: "Capacidade & Demanda", href: "/dashboard/admin/capacity?role=admin", icon: <NavIcon icon={<Gauge size={16} weight="fill" />}        color="cyan"    />, active: active === "capacity", group: "Visão Geral" },

  // ── Operação ──
  { label: "Aprovações",          href: "/dashboard/admin/approvals?role=admin",           icon: <NavIcon icon={<UserCircleCheck size={16} weight="fill" />} color="emerald" />, active: active === "approvals",           group: "Operação" },
  { label: "Verificação KYC",     href: "/dashboard/admin/kyc-review?role=admin",          icon: <NavIcon icon={<IdentificationCard size={16} weight="fill" />} color="cyan"  />, active: active === "kyc-review",          group: "Operação" },
  { label: "Candidaturas Médicos", href: "/dashboard/admin/doctor-applications?role=admin", icon: <NavIcon icon={<ClipboardText size={16} weight="fill" />}  color="blue"    />, active: active === "doctor-applications", group: "Operação" },
  { label: "Funil de Onboarding", href: "/dashboard/admin/onboarding-pipeline?role=admin", icon: <NavIcon icon={<Funnel size={16} weight="fill" />}       color="purple"  />, active: active === "onboarding-pipeline", group: "Operação" },
  { label: "Consultas",           href: "/dashboard/admin/appointments?role=admin",        icon: <NavIcon icon={<CalendarCheck size={16} weight="fill" />}  color="blue"    />, active: active === "appointments",        group: "Operação" },
  { label: "Financeiro",          href: "/dashboard/admin/financial?role=admin",           icon: <NavIcon icon={<Wallet size={16} weight="fill" />}         color="green"   />, active: active === "financial",           group: "Operação" },
  { label: "Repasses",            href: "/dashboard/admin/payouts?role=admin",             icon: <NavIcon icon={<CreditCard size={16} weight="fill" />}     color="green"   />, active: active === "payouts",             group: "Operação" },
  { label: "Notas Fiscais",       href: "/dashboard/admin/nfse?role=admin",                icon: <NavIcon icon={<FileText size={16} weight="fill" />}       color="amber"   />, active: active === "nfse",                group: "Operação" },
  { label: "Contratos",           href: "/dashboard/admin/contratos?role=admin",           icon: <NavIcon icon={<Handshake size={16} weight="fill" />}      color="emerald" />, active: active === "contratos",           group: "Operação" },
  { label: "Leads",               href: "/dashboard/admin/leads?role=admin",               icon: <NavIcon icon={<ChartLineUp size={16} weight="fill" />}    color="blue"    />, active: active === "leads",               group: "Operação" },

  // ── Pessoas ──
  { label: "Usuários",  href: "/dashboard/admin/users?role=admin",    icon: <NavIcon icon={<UserGear size={16} weight="fill" />}    color="blue"    />, active: active === "users",    group: "Pessoas" },
  { label: "Pacientes", href: "/dashboard/admin/patients?role=admin", icon: <NavIcon icon={<Users size={16} weight="fill" />}       color="cyan"    />, active: active === "patients", group: "Pessoas" },
  { label: "Médicos",   href: "/dashboard/admin/doctors?role=admin",  icon: <NavIcon icon={<Stethoscope size={16} weight="fill" />} color="emerald" />, active: active === "doctors",  group: "Pessoas" },
  { label: "Clínicas",  href: "/dashboard/admin/clinics?role=admin",  icon: <NavIcon icon={<Buildings size={16} weight="fill" />}   color="purple"  />, active: active === "clinics",  group: "Pessoas" },

  // ── Conteúdo ──
  { label: "Editor do Site (Studio)", href: "/dashboard/admin/studio?role=admin", icon: <NavIcon icon={<PaintBrush size={16} weight="fill" />} color="purple" />, active: active === "studio",     group: "Conteúdo" },
  { label: "Config do Site", href: "/dashboard/admin/site-config?role=admin",  icon: <NavIcon icon={<Browser size={16} weight="fill" />}     color="blue"   />, active: active === "site-config",  group: "Conteúdo" },
  { label: "Especialidades", href: "/dashboard/admin/specialties?role=admin",  icon: <NavIcon icon={<ShieldStar size={16} weight="fill" />} color="cyan"   />, active: active === "specialties",  group: "Conteúdo" },
  { label: "Cupons",         href: "/dashboard/admin/coupons?role=admin",      icon: <NavIcon icon={<Tag size={16} weight="fill" />}         color="orange" />, active: active === "coupons",      group: "Conteúdo" },
  { label: "Editor Apps",    href: "/dashboard/admin/app-editor?role=admin",   icon: <NavIcon icon={<DeviceMobile size={16} weight="fill" />} color="cyan"   />, active: active === "app-editor", group: "Conteúdo" },
  { label: "Biblioteca de Mídia", href: "/dashboard/admin/media?role=admin",   icon: <NavIcon icon={<ImageIcon size={16} weight="fill" />}   color="cyan"   />, active: active === "media",        group: "Conteúdo" },

  // ── Comunicação ──
  { label: "WhatsApp",      href: "/dashboard/admin/whatsapp?role=admin", icon: <NavIcon icon={<WhatsappLogo size={16} weight="fill" />}          color="green" />, active: active === "whatsapp", group: "Comunicação" },
  { label: "Broadcast",     href: "/dashboard/admin/broadcast?role=admin", icon: <NavIcon icon={<Megaphone size={16} weight="fill" />}             color="amber" />, active: active === "broadcast", group: "Comunicação" },
  { label: "Modelos de Mensagem", href: "/dashboard/admin/notification-templates?role=admin", icon: <NavIcon icon={<EnvelopeSimple size={16} weight="fill" />} color="blue" />, active: active === "notification-templates", group: "Comunicação" },

  // ── Sistema ──
   { label: "Logs & Audit",  href: "/dashboard/admin/logs?role=admin",     icon: <NavIcon icon={<ClockCounterClockwise size={16} weight="fill" />} color="slate" />, active: active === "logs",     group: "Sistema" },
   { label: "Compliance",    href: "/dashboard/admin/compliance?role=admin", icon: <NavIcon icon={<FileText size={16} weight="fill" />}        color="emerald" />, active: active === "compliance", group: "Sistema" },
   { label: "Contratos & Termos", href: "/dashboard/admin/legal?role=admin", icon: <NavIcon icon={<FileText size={16} weight="fill" />}      color="amber" />, active: active === "legal", group: "Sistema" },
   { label: "Segurança",     href: "/dashboard/admin/security?role=admin", icon: <NavIcon icon={<Shield size={16} weight="fill" />}            color="rose"  />, active: active === "security", group: "Sistema" },
   { label: "Sinais de Fraude", href: "/dashboard/admin/fraud-signals?role=admin", icon: <NavIcon icon={<ShieldWarning size={16} weight="fill" />} color="rose" />, active: active === "fraud-signals", group: "Sistema" },
   { label: "Exportações LGPD", href: "/dashboard/admin/lgpd-exports?role=admin", icon: <NavIcon icon={<Database size={16} weight="fill" />}     color="slate" />, active: active === "lgpd-exports", group: "Sistema" },
   { label: "Saúde Sistema", href: "/dashboard/admin/health?role=admin",   icon: <NavIcon icon={<Pulse size={16} weight="fill" />}             color="emerald" />, active: active === "health",   group: "Sistema" },
   { label: "Configuração",  href: "/dashboard/settings?role=admin",       icon: <NavIcon icon={<Sliders size={16} weight="fill" />}               color="slate" />, active: active === "settings", group: "Sistema" },
];
