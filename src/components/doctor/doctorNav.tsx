import {
  CalendarBlank,
  CalendarDots,
  Certificate,
  ChatCircleDots,
  House,
  Lightning,
  Money,
  Sliders,
  Timer,
  UserCircle,
  Users,
  VideoCamera,
  Wallet,
} from "@phosphor-icons/react";
import { FileText, RefreshCw, FlaskConical, Send } from "lucide-react";
import { NavIcon } from "@/components/ui/nav-icon";

export const getDoctorNav = (active: string) => [
  { label: "Inicio", href: "/dashboard?role=doctor", icon: <NavIcon icon={<House size={16} weight="fill" />} color="blue" />, active: active === "home", group: "Principal" },
  { label: "Plantao 24h", href: "/dashboard/doctor/on-duty?role=doctor", icon: <NavIcon icon={<Lightning size={16} weight="fill" />} color="amber" />, active: active === "on-duty", group: "Principal" },
  { label: "Calendario", href: "/dashboard/doctor/calendar?role=doctor", icon: <NavIcon icon={<CalendarDots size={16} weight="fill" />} color="cyan" />, active: active === "calendar", group: "Principal" },
  { label: "Disponibilidade", href: "/dashboard/availability?role=doctor", icon: <NavIcon icon={<CalendarBlank size={16} weight="fill" />} color="slate" />, active: active === "availability", group: "Principal" },
  { label: "Sala de Espera", href: "/dashboard/doctor/waiting-room?role=doctor", icon: <NavIcon icon={<Timer size={16} weight="fill" />} color="orange" />, active: active === "waiting-room", group: "Principal" },
  { label: "Consultas", href: "/dashboard/doctor/consultations?role=doctor", icon: <NavIcon icon={<VideoCamera size={16} weight="fill" />} color="emerald" />, active: active === "consultations", group: "Atendimento" },
  { label: "Pacientes", href: "/dashboard/patients?role=doctor", icon: <NavIcon icon={<Users size={16} weight="fill" />} color="blue" />, active: active === "patients", group: "Atendimento" },
  { label: "Chat", href: "/dashboard/chat?role=doctor", icon: <NavIcon icon={<ChatCircleDots size={16} weight="fill" />} color="cyan" />, active: active === "chat", group: "Atendimento" },
  { label: "Receitas", href: "/dashboard/prescriptions?role=doctor", icon: <NavIcon icon={<FileText className="h-4 w-4" />} color="emerald" />, active: active === "prescriptions", group: "Documentos" },
  { label: "Atestados", href: "/dashboard/certificates?role=doctor", icon: <NavIcon icon={<Certificate size={16} weight="fill" />} color="blue" />, active: active === "certificates", group: "Documentos" },
  { label: "Renovacoes", href: "/dashboard/doctor/renewal-queue?role=doctor", icon: <NavIcon icon={<RefreshCw className="h-4 w-4" />} color="emerald" />, active: active === "renewal-queue", group: "Documentos" },
  { label: "Pedir Exame", href: "/dashboard/exam-request?role=doctor", icon: <NavIcon icon={<FlaskConical className="h-4 w-4" />} color="cyan" />, active: active === "exam-request", group: "Atendimento" },
  { label: "Encaminhar", href: "/dashboard/doctor/referral?role=doctor", icon: <NavIcon icon={<Send className="h-4 w-4" />} color="blue" />, active: active === "referrals", group: "Documentos" },
  { label: "Ganhos", href: "/dashboard/earnings?role=doctor", icon: <NavIcon icon={<Money size={16} weight="fill" />} color="green" />, active: active === "earnings", group: "Financeiro" },
  { label: "Carteira", href: "/dashboard/doctor/wallet?role=doctor", icon: <NavIcon icon={<Wallet size={16} weight="fill" />} color="emerald" />, active: active === "wallet", group: "Financeiro" },
  { label: "Configuracoes", href: "/dashboard/settings?role=doctor", icon: <NavIcon icon={<Sliders size={16} weight="fill" />} color="slate" />, active: active === "settings", group: "Conta" },
  { label: "Meu Perfil", href: "/dashboard/profile?role=doctor", icon: <NavIcon icon={<UserCircle size={16} weight="fill" />} color="blue" />, active: active === "profile", group: "Conta" },
];
