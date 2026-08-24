import { logError } from "@/lib/logger";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminNav } from "@/components/admin/adminNav";
import { KpiCard } from "@/components/admin/KpiCard";
import {
  Users, Stethoscope, Building2, Headphones,
  Handshake, Bot, ShieldCheck, ArrowRight,
  Activity, RefreshCw, Monitor, Sparkles, LayoutGrid,
  UserPlus, Layers, TrendingUp, Zap, Settings2,
  FileText, PieChart, ShieldAlert, Database, 
  CreditCard, ClipboardList, CheckCircle, AlertCircle, History,
  Eye, Heart, Phone, CalendarCheck, UserCheck, Wallet, Megaphone
} from "lucide-react";
import { SquaresFour, WhatsappLogo, Graph } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useServiceHealth } from "@/hooks/use-service-health";
import pingoAdmin from "@/assets/states/pingo-central-admin.webp";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartTooltip, Cell, AreaChart, Area } from "recharts";


interface RecentUser { name: string; page: string; lastSeen: string }
interface PanelInfo {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  glow: string;
  route: string;
  roleKey: string;
  onlineCount: number;
  totalUsers: number;
  recentUsers: RecentUser[];
}

const PANELS: Omit<PanelInfo, "onlineCount" | "totalUsers" | "recentUsers">[] = [
  { id: "doctor",       label: "Médico",        description: "Consultas, prontuários, receitas e telemedicina", icon: Stethoscope,  gradient: "from-emerald-500 to-teal-600",   glow: "shadow-emerald-500/25",   route: "/dashboard?role=doctor",       roleKey: "doctor" },
  { id: "patient",      label: "Paciente",      description: "Agendamentos, histórico e jornada de saúde",   icon: Users,        gradient: "from-blue-500 to-blue-600",      glow: "shadow-blue-500/25",      route: "/dashboard?role=patient",      roleKey: "patient" },
  { id: "support",      label: "Suporte",       description: "Tickets e monitoramento", icon: Headphones,   gradient: "from-amber-500 to-orange-600",      glow: "shadow-amber-500/25",      route: "/dashboard?role=support",      roleKey: "support" },
  { id: "clinic",       label: "Clínicas",      description: "Unidades de saúde parceiras", icon: Building2,  gradient: "from-cyan-500 to-blue-600",      glow: "shadow-cyan-500/25",      route: "/dashboard/admin/clinics?role=admin",  roleKey: "clinic" },
  { id: "ai-assistant", label: "Assistente IA", description: "Chat e triagem inteligente",        icon: Bot,          gradient: "from-purple-500 to-fuchsia-600", glow: "shadow-purple-500/25",    route: "/dashboard/ai-assistant",      roleKey: "ai-assistant" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

const PanelCenter = () => {
  const navigate = useNavigate();
  const [panels, setPanels] = useState<PanelInfo[]>(
    PANELS.map(p => ({ ...p, onlineCount: 0, totalUsers: 0, recentUsers: [] }))
  );
  const [totalOnline, setTotalOnline] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [kpiLeads, setKpiLeads] = useState<number | null>(null);
  const [kpiApptsToday, setKpiApptsToday] = useState<number | null>(null);
  const [kpiPendingDoctors, setKpiPendingDoctors] = useState<number | null>(null);
  const [whatsappState, setWhatsappState] = useState<"loading" | "connected" | "offline" | "unconfigured">("loading");
  const [revenueData, setRevenueData] = useState<{ day: string; revenue: number }[]>([]);

  // Saúde REAL dos serviços (não mais bolinhas verdes fixas). Em produção usa a
  // edge fn service-health; sem ela, cai p/ checagem básica no navegador.
  const { services: healthServices } = useServiceHealth({ poll: true });
  const svcStatus = (key: string) => healthServices.find((s) => s.key === key)?.status;
  const dotColor = (status?: string) =>
    status === "ok" ? "bg-emerald-500"
    : status === "down" ? "bg-red-500"
    : status === "unconfigured" ? "bg-amber-500"
    : "bg-slate-300"; // desconhecido / carregando — honesto, nunca verde falso
  const waColor =
    whatsappState === "connected" ? "bg-emerald-500"
    : whatsappState === "offline" ? "bg-red-500"
    : whatsappState === "unconfigured" ? "bg-amber-500"
    : "bg-slate-300";

  const revenueTotal = useMemo(() => revenueData.reduce((acc, d) => acc + d.revenue, 0), [revenueData]);
  const isRevenueEmpty = revenueTotal === 0;
  const formatBrl = (n: number) =>
    `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fetchPresence = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const { data: onlineUsers } = await db
        .from("user_presence")
        .select("user_id, current_page, last_seen_at, is_online")
        .eq("is_online", true)
        .gte("last_seen_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

      const { data: allRoles } = await db.from("user_roles").select("user_id, role");
      const onlineUserIds = [...new Set((onlineUsers ?? []).map(u => u.user_id))];

      const onlineRolesMap: Map<string, string[]> = new Map();
      const profilesMap: Map<string, string> = new Map();

      if (onlineUserIds.length > 0) {
        const [{ data: onlineRoles }, { data: profiles }] = await Promise.all([
          db.from("user_roles").select("user_id, role").in("user_id", onlineUserIds),
          db.from("profiles").select("user_id, first_name, last_name").in("user_id", onlineUserIds),
        ]);
        (onlineRoles ?? []).forEach(r => {
          const ex = onlineRolesMap.get(r.user_id) ?? [];
          ex.push(r.role);
          onlineRolesMap.set(r.user_id, ex);
        });
        (profiles ?? []).forEach(p => {
          profilesMap.set(p.user_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Usuário");
        });
      }

      const roleTotals: Record<string, number> = {};
      (allRoles ?? []).forEach(r => { roleTotals[r.role] = (roleTotals[r.role] ?? 0) + 1; });

      const panelOnlineMap: Record<string, RecentUser[]> = {};
      (onlineUsers ?? []).forEach(u => {
        const page = u.current_page ?? "/dashboard";
        const roles = onlineRolesMap.get(u.user_id) ?? ["patient"];
        const name = profilesMap.get(u.user_id) ?? "Usuário";

        let panelId = "patient";
        if (page.includes("ai-assistant")) panelId = "ai-assistant";
        else if (page.includes("role=admin") || page.includes("/admin/")) panelId = "admin";
        else if (page.includes("role=doctor") || page.includes("/doctor/")) panelId = "doctor";
        else if (page.includes("role=receptionist") || page.includes("/reception/")) panelId = "receptionist";
        else if (page.includes("role=support")) panelId = "support";
        else if (page.includes("role=clinic") || page.includes("/clinic/")) panelId = "clinic";
        else if (page.includes("role=partner")) panelId = "partner";
        else if (roles.includes("doctor")) panelId = "doctor";
        else if (roles.includes("admin")) panelId = "admin";

        if (!panelOnlineMap[panelId]) panelOnlineMap[panelId] = [];
        panelOnlineMap[panelId].push({
          name,
          page: page.replace("/dashboard", "").replace("?role=", "").slice(0, 30) || "Início",
          lastSeen: u.last_seen_at,
        });
      });

      setPanels(PANELS.map(p => ({
        ...p,
        onlineCount: panelOnlineMap[p.id]?.length ?? 0,
        totalUsers: p.id === "ai-assistant" ? 0 : (roleTotals[p.roleKey] ?? 0),
        recentUsers: (panelOnlineMap[p.id] ?? []).slice(0, 5),
      })));
      setTotalOnline(onlineUserIds.length);
      setTotalUsers(new Set((allRoles ?? []).map(r => r.user_id)).size);
    } catch (e) {
      logError("PanelCenter fetch error", e);
    }
    setRefreshing(false);
    setLastRefresh(new Date());
  };

  const fetchKpis = async () => {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
      const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

      const [leadsRes, apptsRes, pendingRes, revenueRes] = await Promise.all([
        db.from("contract_leads").select("id", { count: "exact", head: true }),
        db.from("appointments").select("id", { count: "exact", head: true })
          .gte("scheduled_at", startOfToday.toISOString())
          .lt("scheduled_at", startOfTomorrow.toISOString()),
        db.from("doctor_profiles").select("id", { count: "exact", head: true }).eq("is_approved", false),
        db.from("appointments").select("scheduled_at, price_at_booking, payment_status")
          .gte("scheduled_at", sevenDaysAgo.toISOString())
          .in("payment_status", ["approved", "confirmed"])
          .limit(5000),
      ]);

      setKpiLeads(leadsRes.count ?? 0);
      setKpiApptsToday(apptsRes.count ?? 0);
      setKpiPendingDoctors(pendingRes.count ?? 0);

      const buckets: { day: string; revenue: number }[] = [];
      const idxByKey = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
        idxByKey.set(dayKey(d), buckets.length);
        buckets.push({ day: format(d, "EEE", { locale: ptBR }), revenue: 0 });
      }
      (revenueRes.data ?? []).forEach((a: any) => {
        if (!a.scheduled_at) return;
        const idx = idxByKey.get(dayKey(new Date(a.scheduled_at)));
        if (idx !== undefined) buckets[idx].revenue += Number(a.price_at_booking) || 0;
      });
      setRevenueData(buckets);
    } catch (e) {
      logError("PanelCenter KPIs fetch error", e);
    }
  };

  const fetchWhatsappState = async () => {
    try {
      const { data, error } = await db.functions.invoke("whatsapp-qr", { body: { action: "list" } });
      if (error || data?.success === false) { setWhatsappState("unconfigured"); return; }
      const instances: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const connected = instances.some((i: any) => {
        const s = i.instance?.status ?? i.instance?.state ?? i.status ?? i.state;
        return s === "open";
      });
      setWhatsappState(connected ? "connected" : "offline");
    } catch {
      setWhatsappState("unconfigured");
    }
  };

  useEffect(() => {
    fetchPresence();
    fetchKpis();
    fetchWhatsappState();
    const interval = setInterval(() => { fetchPresence(); fetchKpis(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = db
      .channel("panel-center-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, () => fetchPresence())
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, []);

  const liveActivity = useMemo(() => {
    const all: { name: string; page: string; lastSeen: string; panel: PanelInfo }[] = [];
    panels.forEach(p => p.recentUsers.forEach(u => all.push({ ...u, panel: p })));
    return all
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
      .slice(0, 8);
  }, [panels]);

  const activePanels = panels.filter(p => p.onlineCount > 0).length;

  const whatsappLabel =
    whatsappState === "connected" ? "Conectado"
    : whatsappState === "offline" ? "Desconectado"
    : whatsappState === "loading" ? "…"
    : "Configurável";

    const stats = [
      {
        label: "Online agora",
        sublabel: "Usuários conectados",
        value: totalOnline,
        badge: "Live",
        icon: Zap,
        gradient: "from-emerald-400 via-emerald-500 to-teal-600",
        ring: "ring-emerald-500/30",
        glow: "shadow-emerald-500/20",
        sparkColor: "stroke-emerald-500",
        route: "/dashboard/admin/live?role=admin"
      },
      {
        label: "Leads",
        sublabel: "Novos contatos",
        value: kpiLeads ?? "—",
        badge: "Total",
        icon: UserPlus,
        gradient: "from-blue-400 via-blue-500 to-indigo-600",
        ring: "ring-blue-500/30",
        glow: "shadow-blue-500/20",
        sparkColor: "stroke-blue-500",
        route: "/dashboard/admin/leads?role=admin"
      },
      {
        label: "WhatsApp API",
        sublabel: "Automações & Bots",
        value: whatsappLabel,
        badge: "Status",
        icon: WhatsappLogo,
        gradient: "from-green-400 via-green-500 to-emerald-600",
        ring: "ring-green-500/30",
        glow: "shadow-green-500/20",
        sparkColor: "stroke-green-500",
        route: "/dashboard/admin/whatsapp?role=admin"
      },
      {
        label: "Aprovações",
        sublabel: "Médicos pendentes",
        value: kpiPendingDoctors ?? "—",
        badge: "Fila",
        icon: UserCheck,
        gradient: "from-orange-400 via-orange-500 to-red-600",
        ring: "ring-orange-500/30",
        glow: "shadow-orange-500/20",
        sparkColor: "stroke-orange-500",
        route: "/dashboard/admin/approvals?role=admin"
      },
      {
        label: "Consultas",
        sublabel: "Agendadas hoje",
        value: kpiApptsToday ?? "—",
        badge: "Hoje",
        icon: ClipboardList,
        gradient: "from-violet-400 via-violet-500 to-purple-600",
        ring: "ring-violet-500/30",
        glow: "shadow-violet-500/20",
        sparkColor: "stroke-violet-500",
        route: "/dashboard/admin/appointments?role=admin"
      },
    ];


    const quickActions = [
      { label: "Aprovações", icon: UserCheck, route: "/dashboard/admin/approvals?role=admin", color: "text-emerald-500", bg: "bg-emerald-500/10" },
      { label: "Consultas", icon: CalendarCheck, route: "/dashboard/admin/appointments?role=admin", color: "text-blue-500", bg: "bg-blue-500/10" },
      { label: "Financeiro", icon: Wallet, route: "/dashboard/admin/financial?role=admin", color: "text-green-500", bg: "bg-green-500/10" },
      { label: "Relatórios", icon: Graph, route: "/dashboard/admin/reports?role=admin", color: "text-cyan-500", bg: "bg-cyan-500/10" },
      { label: "Leads", icon: UserPlus, route: "/dashboard/admin/leads?role=admin", color: "text-indigo-500", bg: "bg-indigo-500/10" },
      { label: "Broadcast", icon: Megaphone, route: "/dashboard/admin/broadcast?role=admin", color: "text-orange-500", bg: "bg-orange-500/10" },
      { label: "Segurança", icon: ShieldCheck, route: "/dashboard/admin/security?role=admin", color: "text-rose-500", bg: "bg-rose-500/10" },
      { label: "Contratos", icon: Handshake, route: "/dashboard/admin/contratos?role=admin", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    ];

  return (
    <DashboardLayout title="Centro de Painéis" nav={getAdminNav("panel-center")}>
      <motion.div variants={container} initial="hidden" animate="show" className="w-full max-w-7xl mx-auto space-y-4 md:space-y-6 pb-24 md:pb-8 min-w-0">

        {/* ─────── HERO HEADER ─────── */}
        <motion.section variants={fadeUp}>
          <Card className="relative overflow-hidden rounded-2xl border-border/50 bg-card shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.25)]">
            {/* Soft ambient light — no grid/checker pattern */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_120%_at_0%_0%,hsl(var(--primary)/0.10),transparent_60%)]" />
            <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-secondary/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
            {/* Top accent line */}
            <div className="h-[3px] bg-gradient-to-r from-primary via-secondary to-primary/40" />

            <div className="relative grid lg:grid-cols-[1fr_auto] gap-0 min-w-0">
              <div className="p-4 sm:p-6 md:p-8 flex flex-col justify-center min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 ring-1 ring-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
                    <LayoutGrid className="w-3 h-3" />
                    Centro de Controle
                  </span>
                  <Badge variant="secondary" className="gap-1.5 font-mono text-[10px] h-6 backdrop-blur-sm">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    LIVE · {format(lastRefresh, "HH:mm:ss")}
                  </Badge>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-transparent break-words">
                  Painéis da Plataforma
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-xl">
                  <span className="font-bold text-foreground">{totalOnline}</span> {totalOnline === 1 ? "pessoa online" : "pessoas online"} agora · sincronizado {formatDistanceToNow(lastRefresh, { locale: ptBR, addSuffix: true })}
                </p>

                <div className="flex flex-wrap gap-2 mt-5">
                  <Button
                    size="sm"
                    onClick={() => { fetchPresence(true); fetchKpis(); fetchWhatsappState(); }}
                    disabled={refreshing}
                    className="gap-2 rounded-xl bg-gradient-to-br from-primary to-blue-700 hover:opacity-90 shadow-md shadow-primary/20"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                    Atualizar agora
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/dashboard/admin/live?role=admin")}
                    className="gap-2 rounded-xl backdrop-blur-sm bg-background/50"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Ver ao vivo
                  </Button>
                </div>
              </div>

              <div className="relative hidden lg:flex items-end justify-center pr-10 pl-4">
                <div className="pointer-events-none absolute bottom-4 h-24 w-56 rounded-full bg-primary/15 blur-2xl" />
                <motion.img
                  src={pingoAdmin}
                  alt="Pingo Admin"
                  className="relative h-44 w-auto object-contain drop-shadow-2xl"
                  loading="lazy"
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          </Card>
        </motion.section>

        {/* ─────── QUICK ACTIONS + STATUS BAR ─────── */}
        <motion.section variants={fadeUp} className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 px-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" fill="currentColor" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Ações Rápidas</h2>
            </div>
            <div className="flex items-center gap-x-3 sm:gap-x-4 gap-y-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  {whatsappState === "connected" && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                  )}
                  <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", waColor)} />
                </span>
                WhatsApp
              </span>
              <span className="flex items-center gap-1.5"><div className={cn("w-1.5 h-1.5 rounded-full", dotColor(svcStatus("payments")))} /> Pagamentos</span>
              <span className="flex items-center gap-1.5"><div className={cn("w-1.5 h-1.5 rounded-full", dotColor(svcStatus("video")))} /> Vídeo HD</span>
              <span className="flex items-center gap-1.5"><div className={cn("w-1.5 h-1.5 rounded-full", dotColor(svcStatus("database")))} /> <span className="hidden xs:inline">Banco de </span>Dados</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-2.5">
            {quickActions.map((action, idx) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.25 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(action.route)}
                className="h-auto py-3 sm:py-3.5 px-2 flex flex-col items-center gap-2 sm:gap-2.5 bg-card hover:bg-muted/40 border border-border/40 hover:border-primary/30 rounded-2xl group transition-colors min-w-0"
              >
                <div className={cn("p-2 rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", action.bg)}>
                  <action.icon className={cn("w-4 h-4", action.color)} />
                </div>
                <span className="text-[10px] font-bold text-foreground text-center line-clamp-1 w-full">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.section>

        {/* ─────── FATURAMENTO 7d ─────── */}
        <motion.section variants={fadeUp}>
          <Card className="border-border/40 bg-gradient-to-b from-card/95 to-card/70 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="px-5 py-3 border-b border-border/40 flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex flex-col min-w-0">
                  <CardTitle className="text-sm font-bold text-foreground leading-tight truncate">Faturamento · últimos 7 dias</CardTitle>
                  <span className="text-xs text-muted-foreground truncate">
                    {isRevenueEmpty ? "Nenhum pagamento confirmado" : formatBrl(revenueTotal)}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-border/60 bg-muted/30 shrink-0">
                pagamentos confirmados
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[220px] relative">
                {isRevenueEmpty ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                    <div className="relative w-16 h-16 mb-3 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-primary/10 blur-md" />
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-secondary/10" />
                      <TrendingUp className="relative w-7 h-7 text-primary/60" />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">Sem faturamento confirmado</p>
                    <p className="text-xs text-muted-foreground max-w-[220px]">
                      Os pagamentos aprovados nos últimos 7 dias aparecerão neste gráfico.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData} margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        dy={8}
                      />
                      <YAxis hide domain={[0, "auto"]} />
                      <RechartTooltip
                        cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                          fontSize: 12,
                          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                        }}
                        formatter={(value: number) => [formatBrl(value), "Faturamento"]}
                        labelFormatter={(label: string) => label}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorRev)"
                        activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))", fill: "hsl(var(--primary))" }}
                        dot={{ r: 3, strokeWidth: 0, fill: "hsl(var(--primary) / 0.5)" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─────── KPI CARDS ─────── */}
        <motion.section
          variants={container}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
        >
          {stats.map((s, i) => (
            <KpiCard
              key={s.label}
              label={s.label}
              sublabel={s.sublabel}
              value={s.value}
              badge={s.badge}
              icon={s.icon}
              gradient={s.gradient}
              ring={s.ring}
              glow={s.glow}
              sparkColor={s.sparkColor}
              route={s.route}
              index={i}
              onClick={() => navigate(s.route)}
            />
          ))}
        </motion.section>


        {/* ─────── PANELS GRID (now primary) ─────── */}
        <motion.section variants={fadeUp} className="space-y-4">
          <div className="flex items-start sm:items-end justify-between flex-wrap gap-3 sm:gap-4 px-1">
            <div className="space-y-1 min-w-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2 flex-wrap">
                <SquaresFour className="w-6 h-6 text-primary" weight="fill" />
                Painéis de Controle
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">Gerencie e monitore cada módulo da plataforma</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5 py-1 px-3 text-[11px] font-bold uppercase tracking-wider bg-primary/5 border-primary/10 text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                {PANELS.length} painéis
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {panels.map((panel) => {
              const Icon = panel.icon;
              const hasOnline = panel.onlineCount > 0;
              return (
                <motion.div
                  key={panel.id}
                  variants={fadeUp}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className={cn(
                      "relative overflow-hidden cursor-pointer group h-full border-border/40",
                      "bg-gradient-to-br from-card via-card to-muted/30 hover:to-primary/[0.03]",
                      "hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:border-primary/40 transition-all duration-500",
                      hasOnline && panel.glow
                    )}
                    onClick={() => navigate(panel.route)}
                  >
                    {/* Top gradient line */}
                    <div className={cn("h-[3px] bg-gradient-to-r opacity-70 group-hover:opacity-100 transition-opacity", panel.gradient)} />
                    
                    {/* Background patterns */}
                    <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
                      <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,var(--tw-gradient-from),transparent_60%)]" />
                    </div>

                    <CardContent className="relative p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-lg ring-1 ring-white/20 dark:ring-white/10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500",
                          panel.gradient
                        )}>
                          <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                        </div>
                        
                        <div className="flex flex-col items-end gap-1.5">
                          {hasOnline ? (
                            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ring-1 ring-emerald-500/30 backdrop-blur-sm animate-in fade-in zoom-in duration-500">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                              </span>
                              {panel.onlineCount} Online
                            </div>
                          ) : (
                            <div className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-muted/50 text-muted-foreground ring-1 ring-border/50">
                              Offline
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="text-base font-black text-foreground group-hover:text-primary transition-colors tracking-tight">
                          {panel.label}
                        </h3>
                        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 min-h-[3em]">
                          {panel.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/40">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">Total Usuários</span>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-primary/60" />
                            <span className="text-sm font-black text-foreground tabular-nums tracking-tight">{panel.totalUsers.toLocaleString()}</span>
                          </div>
                        </div>
                        
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm",
                          "bg-muted/40 group-hover:bg-primary group-hover:shadow-primary/20",
                        )}>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-white group-hover:translate-x-0.5 transition-all duration-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ─────── ACTIVITY FEED ─────── */}
        <div className="grid lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Distribution chart (spans 3 cols at top of activity row on mobile, sits beside on lg) */}
          <motion.div variants={fadeUp} className="lg:col-span-3 min-w-0">
            <Card className="border-border/40 bg-gradient-to-br from-card via-card to-muted/20 overflow-hidden">
              <div className="h-[2px] bg-gradient-to-r from-primary via-violet-500 to-emerald-500" />
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shadow-md ring-1 ring-white/20">
                    <PieChart className="w-4 h-4 text-white" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-foreground leading-tight">Distribuição por painel</h2>
                    <p className="text-[11px] text-muted-foreground">Usuários cadastrados em cada módulo</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                    {totalUsers} totais
                  </Badge>
                </div>
                <div className="h-[220px] -mx-2 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={panels
                        .filter(p => p.id !== "ai-assistant")
                        .map(p => ({
                          name: p.label.length > 10 ? p.label.slice(0, 9) + "…" : p.label,
                          total: p.totalUsers,
                          online: p.onlineCount,
                          gradient: p.gradient,
                        }))}
                      margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                      barCategoryGap={8}
                    >
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9.5, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={42}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        width={28}
                      />
                      <RechartTooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                          fontSize: 12,
                          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                        }}
                        formatter={(value: number, name: string) => [
                          `${value}`,
                          name === "total" ? "Cadastrados" : "Online",
                        ]}
                      />
                      <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                        {panels
                          .filter(p => p.id !== "ai-assistant")
                          .map((p, idx) => {
                            const colorMap: Record<string, string> = {
                              admin: "hsl(215 75% 38%)",
                              clinic: "hsl(265 75% 56%)",
                              doctor: "hsl(160 70% 42%)",
                              patient: "hsl(220 90% 56%)",
                              receptionist: "hsl(35 90% 52%)",
                              support: "hsl(345 80% 60%)",
                              partner: "hsl(175 70% 42%)",
                            };
                            return <Cell key={p.id} fill={colorMap[p.id] ?? "hsl(var(--primary))"} />;
                          })}
                      </Bar>
                      <Bar dataKey="online" radius={[8, 8, 0, 0]} fill="hsl(145 70% 48%)" opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-5 mt-1 text-[10.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Cadastrados
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Online agora
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp} className="lg:col-span-3 min-w-0">
            <Card className="h-full border-border/40 bg-gradient-to-br from-card via-card to-muted/20 overflow-hidden">
              <div className="h-[2px] bg-gradient-to-r from-emerald-500 via-primary to-purple-500" />
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md ring-1 ring-white/20">
                    <Activity className="w-4 h-4 text-white" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-foreground leading-tight">Atividade em tempo real</h2>
                    <p className="text-[11px] text-muted-foreground">{liveActivity.length} eventos · atualiza a cada 15s</p>
                  </div>
                  <Badge variant="secondary" className="gap-1 text-[10px] font-mono">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    LIVE
                  </Badge>
                </div>

                {liveActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-muted to-muted/30 flex items-center justify-center mb-3 ring-1 ring-border/40">
                      <Sparkles className="w-6 h-6 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Nenhum usuário online</p>
                    <p className="text-xs text-muted-foreground mt-0.5">A presença atualiza automaticamente</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {liveActivity.map((u, i) => {
                      const Icon = u.panel.icon;
                      return (
                        <motion.button
                          key={`${u.name}-${i}`}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => navigate(u.panel.route)}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 ring-1 ring-transparent hover:ring-border/60 transition-all text-left group"
                        >
                          <div className={cn(
                            "shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm ring-1 ring-white/20",
                            u.panel.gradient
                          )}>
                            <Icon className="w-4 h-4 text-white" strokeWidth={2.2} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                              </span>
                              <p className="text-xs font-semibold text-foreground truncate">{u.name}</p>
                            </div>
                            <p className="text-[10.5px] text-muted-foreground font-mono truncate">
                              {u.panel.label} · {u.page || "/"}
                            </p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
        
        {/* ─────── ADMIN SYSTEM ACTIONS ─────── */}
        <motion.section variants={fadeUp} className="space-y-3 sm:space-y-4 pt-2 sm:pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-1 gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Sistema &amp; Auditoria</h2>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono truncate">
              {activePanels}/{PANELS.length} painéis ativos · sync {format(lastRefresh, "HH:mm:ss")}
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {[
              { label: "Logs de Erro", icon: ShieldAlert, color: "text-rose-500", bg: "bg-rose-500/10", route: "/dashboard/admin/logs?role=admin" },
              { label: "Site Config", icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10", route: "/dashboard/admin/site-config?role=admin" },
              { label: "Relatórios", icon: PieChart, color: "text-amber-500", bg: "bg-amber-500/10", route: "/dashboard/admin/reports?role=admin" },
              { label: "Banco Dados", icon: Database, color: "text-emerald-500", bg: "bg-emerald-500/10", route: "/dashboard/admin/health?role=admin" },
              { label: "Auditoria", icon: ShieldCheck, color: "text-indigo-500", bg: "bg-indigo-500/10", route: "/dashboard/admin/logs?role=admin" },
              { label: "Usuários", icon: UserPlus, color: "text-orange-500", bg: "bg-orange-500/10", route: "/dashboard/admin/users?role=admin" },
            ].map((action) => (
              <Button
                key={action.label}
                variant="outline"
                className="h-auto flex flex-col items-center gap-2 p-3 border-border/40 bg-card/40 hover:bg-card hover:border-primary/40 hover:shadow-lg transition-all group overflow-hidden relative"
                onClick={() => navigate(action.route)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 relative z-10", action.bg)}>
                  <action.icon className={cn("w-5 h-5", action.color)} />
                </div>
                <span className="text-[11px] font-black text-foreground relative z-10 tracking-tight">{action.label}</span>
              </Button>
            ))}
          </div>
        </motion.section>

      </motion.div>
    </DashboardLayout>
  );
};

export default PanelCenter;
