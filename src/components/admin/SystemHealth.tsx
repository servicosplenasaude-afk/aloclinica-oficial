import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getAdminNav } from "@/components/admin/adminNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, CheckCircle2, XCircle, Clock, Database, Bot, Globe, Server, Users, FileText, Calendar, HardDrive, Shield, Video, MessageCircle, CreditCard, Mail, Plug, GitCommitHorizontal, Archive, Activity, ArrowUpRight, Settings2, TriangleAlert, Copy, Download, Gauge, CircleOff } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { SUPABASE_FUNCTIONS_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase-config";
import { useServiceHealth } from "@/hooks/use-service-health";
import { getBackupState, getSystemPresentationState, shortRelease } from "@/lib/admin-system-health";
import { buildHealthReport, filterDiagnostics, healthReportText, type DiagnosticFilter, type DiagnosticItem } from "@/lib/admin-health-report";
import { toast } from "sonner";

interface HealthCheck {
  name: string;
  status: "ok" | "error" | "checking";
  latency?: number;
  message?: string;
  icon: React.ReactNode;
  group?: "core" | "vps" | "integration";
}

interface DbStats {
  patients: number;
  doctors: number;
  appointments: number;
  prescriptions: number;
  activeSubscriptions: number;
  queueWaiting: number;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const SystemHealth = () => {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [running, setRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [serviceFilter, setServiceFilter] = useState<DiagnosticFilter>("all");
  const [dbStatsError, setDbStatsError] = useState(false);
  // Verificação REAL dos serviços externos (WhatsApp, e-mail, vídeo, KYC, pagamentos, NFS-e).
  const health = useServiceHealth({ poll: autoRefresh });

  const fetchDbStats = useCallback(async () => {
    const [patients, doctors, appts, prescriptions, subs, queue] = await Promise.all([
      db.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "patient"),
      db.from("doctor_profiles").select("id", { count: "exact", head: true }),
      db.from("appointments").select("id", { count: "exact", head: true }),
      db.from("prescriptions").select("id", { count: "exact", head: true }),
      db.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      db.from("on_demand_queue").select("id", { count: "exact", head: true }).eq("status", "waiting"),
    ]);
    const failed = [patients, doctors, appts, prescriptions, subs, queue].some((result) => Boolean(result.error));
    setDbStatsError(failed);
    if (failed) {
      setDbStats(null);
      return;
    }
    setDbStats({
      patients: patients.count ?? 0,
      doctors: doctors.count ?? 0,
      appointments: appts.count ?? 0,
      prescriptions: prescriptions.count ?? 0,
      activeSubscriptions: subs.count ?? 0,
      queueWaiting: queue.count ?? 0,
    });
  }, []);

  const refreshServiceHealth = health.refresh;
  const runChecks = useCallback(async () => {
    setRunning(true);
    void refreshServiceHealth(); // atualiza também a verificação real dos serviços externos
    const results: HealthCheck[] = [];

    // 1. Database
    const dbStart = performance.now();
    try {
      const { error } = await db.from("specialties").select("id").limit(1);
      const latency = Math.round(performance.now() - dbStart);
      results.push({
        name: "Banco de Dados (PostgreSQL)",
        status: error ? "error" : "ok",
        latency,
        message: error ? error.message : `Respondendo em ${latency}ms`,
        icon: <Database className="w-5 h-5" />,
        group: "core",
      });
    } catch (e: unknown) {
      results.push({ name: "Banco de Dados (PostgreSQL)", status: "error", message: e instanceof Error ? e.message : "Erro desconhecido", icon: <Database className="w-5 h-5" />, group: "core" });
    }

    // 2. Auth
    const authStart = performance.now();
    try {
      const { data } = await db.auth.getSession();
      const latency = Math.round(performance.now() - authStart);
      results.push({
        name: "Autenticação (GoTrue)",
        status: "ok",
        latency,
        message: data.session ? `Sessão ativa • ${latency}ms` : `Sem sessão • ${latency}ms`,
        icon: <Server className="w-5 h-5" />,
        group: "core",
      });
    } catch (e: unknown) {
      results.push({ name: "Autenticação (GoTrue)", status: "error", message: e instanceof Error ? e.message : "Erro desconhecido", icon: <Server className="w-5 h-5" />, group: "core" });
    }

    // 3. Edge Functions
    const efStart = performance.now();
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/calculate-shift-price`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({}),
      });
      const latency = Math.round(performance.now() - efStart);
      results.push({
        name: "Edge Functions (Deno)",
        status: res.ok || res.status === 400 ? "ok" : "error",
        latency,
        message: `Gateway ativo • ${latency}ms`,
        icon: <Bot className="w-5 h-5" />,
        group: "core",
      });
    } catch (e: unknown) {
      results.push({ name: "Edge Functions (Deno)", status: "error", message: e instanceof Error ? e.message : "Erro desconhecido", icon: <Bot className="w-5 h-5" />, group: "core" });
    }

    // 4. Realtime
    const rtStart = performance.now();
    try {
      const channel = db.channel("health-check-ping");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { reject(new Error("Timeout")); }, 5000);
        channel.subscribe((status) => {
          clearTimeout(timeout);
          if (status === "SUBSCRIBED") resolve();
          else reject(new Error(`Status: ${status}`));
        });
      });
      db.removeChannel(channel);
      const latency = Math.round(performance.now() - rtStart);
      results.push({
        name: "Realtime (WebSocket)",
        status: "ok",
        latency,
        message: `Conectado • ${latency}ms`,
        icon: <Globe className="w-5 h-5" />,
        group: "core",
      });
    } catch (e: unknown) {
      results.push({ name: "Realtime (WebSocket)", status: "error", message: e instanceof Error ? e.message : "Erro desconhecido", icon: <Globe className="w-5 h-5" />, group: "core" });
    }

    // 5. Storage
    const stStart = performance.now();
    try {
      const { error } = await db.storage.from("avatars").list("", { limit: 1 });
      const latency = Math.round(performance.now() - stStart);
      results.push({
        name: "Storage (S3)",
        status: error ? "error" : "ok",
        latency,
        message: error ? error.message : `Acessível • ${latency}ms`,
        icon: <HardDrive className="w-5 h-5" />,
        group: "core",
      });
    } catch (e: unknown) {
      results.push({ name: "Storage (S3)", status: "error", message: e instanceof Error ? e.message : "Erro desconhecido", icon: <HardDrive className="w-5 h-5" />, group: "core" });
    }

    // Serviços externos (WhatsApp, e-mail, vídeo, KYC, pagamentos, NFS-e) NÃO são
    // checados aqui: a verificação por OPTIONS do navegador não é confiável (dava
    // "Failed to fetch" em massa mesmo com o serviço no ar). A verificação correta
    // é feita na seção "Serviços externos" (edge function service-health, com
    // fallback básico no navegador via useServiceHealth).

    setChecks(results);
    setLastCheck(new Date());
    setRunning(false);
    void fetchDbStats();
  }, [fetchDbStats, refreshServiceHealth]);

  useEffect(() => { void runChecks(); }, [runChecks]);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => void runChecks(), 2 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, runChecks]);

  // Falhas reais dos serviços externos (verificação no servidor) entram no status geral.
  const serverDown = health.summary.down;
  const operational = health.data?.operational;
  const backupState = getBackupState(operational);
  const backupFailed = backupState === "failed" || backupState === "never" || backupState === "stale";
  const coreErrors = checks.filter(c => c.status === "error").length;
  const systemState = getSystemPresentationState({
    running,
    coreTotal: checks.length,
    coreErrors,
    externalDown: serverDown,
    unconfigured: health.summary.unconfigured,
    backupState,
  });
  const hasWarnings = systemState === "warning";
  const allOk = systemState === "operational";
  const hasErrors = systemState === "error";
  const failCount = coreErrors + serverDown + (backupFailed ? 1 : 0);
  const avgLatency = checks.length > 0 ? Math.round(checks.reduce((sum, c) => sum + (c.latency ?? 0), 0) / checks.length) : 0;

  const dbStatCards = dbStats ? [
    { label: "Pacientes", value: dbStats.patients, icon: Users, color: "text-primary" },
    { label: "Médicos", value: dbStats.doctors, icon: Users, color: "text-secondary" },
    { label: "Consultas", value: dbStats.appointments, icon: Calendar, color: "text-primary" },
    { label: "Receitas", value: dbStats.prescriptions, icon: FileText, color: "text-success" },
    { label: "Assinaturas", value: dbStats.activeSubscriptions, icon: Server, color: "text-success" },
    { label: "Fila Urgência", value: dbStats.queueWaiting, icon: Clock, color: dbStats.queueWaiting > 0 ? "text-destructive" : "text-muted-foreground" },
  ] : [];

  const backupPresentation = ({
    healthy: { label: "Saudável", badge: "ATUALIZADO", tone: "text-success", variant: "default" as const },
    stale: { label: "Último backup está atrasado", badge: "ATRASADO", tone: "text-amber-600", variant: "secondary" as const },
    failed: { label: "A execução mais recente falhou", badge: "FALHA", tone: "text-destructive", variant: "destructive" as const },
    never: { label: "Nenhum backup concluído registrado", badge: "SEM BACKUP", tone: "text-destructive", variant: "destructive" as const },
    unavailable: { label: "Status indisponível", badge: "INDISPONÍVEL", tone: "text-muted-foreground", variant: "secondary" as const },
  })[backupState];

  const diagnostics = useMemo<DiagnosticItem[]>(() => {
    const core: DiagnosticItem[] = checks.map((check, index) => ({
      key: `core-${index}`,
      label: check.name,
      status: check.status === "error" ? "error" : check.status,
      detail: check.message,
      latencyMs: check.latency,
      critical: true,
      source: "core",
    }));
    const external: DiagnosticItem[] = health.services.map((service) => ({
      key: service.key,
      label: service.label,
      status: service.status,
      detail: service.detail,
      latencyMs: service.latencyMs,
      critical: service.critical,
      source: "external",
    }));
    const backup: DiagnosticItem = {
      key: "backup",
      label: "Backup operacional",
      status: backupState === "healthy" ? "ok" : backupState === "unavailable" ? "unconfigured" : "error",
      detail: backupPresentation.label,
      critical: true,
      source: "backup",
    };
    return [...core, ...external, backup];
  }, [backupPresentation.label, backupState, checks, health.services]);

  const filteredDiagnostics = filterDiagnostics(diagnostics, serviceFilter);
  const report = useMemo(() => buildHealthReport({
    checkedAt: (lastCheck ?? health.lastRun ?? new Date()).toISOString(),
    environment: operational?.environment ?? "unknown",
    release: shortRelease(operational?.release),
    items: diagnostics,
  }), [diagnostics, health.lastRun, lastCheck, operational?.environment, operational?.release]);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(healthReportText(report));
      toast.success("Diagnóstico copiado");
    } catch {
      toast.error("Não foi possível copiar o diagnóstico");
    }
  };

  const downloadReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aloclinica-diagnostico-${new Date().toISOString().replace(/:/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Administração" nav={getAdminNav("health")}>
      <motion.div variants={container} initial="hidden" animate="show" className="max-w-6xl space-y-6 pb-24 md:pb-8">
        <motion.header variants={fadeUp} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
                <Activity className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground sm:text-2xl">Operação da plataforma</h1>
                  <Badge variant={hasErrors ? "destructive" : allOk ? "default" : "secondary"}>
                    {running ? "Verificando" : hasErrors ? "Requer atenção" : hasWarnings ? "Configuração parcial" : allOk ? "Operacional" : "Aguardando diagnóstico"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Monitore serviços, recuperação e capacidade. Para interromper o acesso público, use o modo manutenção.
                </p>
                <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                  {lastCheck ? `Última verificação em ${format(lastCheck, "dd/MM/yyyy 'às' HH:mm:ss")}` : "A primeira verificação será executada automaticamente."}
                </p>
              </div>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto">
              <Button asChild variant="outline" className="min-h-11 justify-center rounded-xl">
                <Link to="/dashboard/admin/platform-settings">
                  <Settings2 className="mr-2 h-4 w-4" />
                  Configurar manutenção
                </Link>
              </Button>
              <Button className="min-h-11 rounded-xl" onClick={runChecks} disabled={running}>
                <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />
                {running ? "Verificando..." : "Verificar agora"}
              </Button>
            </div>
          </div>
        </motion.header>

        <motion.section variants={fadeUp} aria-label="Resumo operacional" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Operacionais", value: report.totals.operational, helper: `de ${report.totals.total}`, icon: CheckCircle2, tone: "text-success bg-success/10" },
            { label: "Requerem atenção", value: report.totals.attention, helper: "falha confirmada", icon: TriangleAlert, tone: report.totals.attention ? "text-destructive bg-destructive/10" : "text-muted-foreground bg-muted" },
            { label: "Não configurados", value: report.totals.unconfigured, helper: "integrações", icon: CircleOff, tone: "text-amber-600 bg-amber-500/10" },
            { label: "Latência do núcleo", value: `${avgLatency}ms`, helper: `${checks.length} verificações`, icon: Gauge, tone: "text-primary bg-primary/10" },
          ].map((metric) => (
            <Card key={metric.label} className="border-border/60">
              <CardContent className="p-4 sm:p-5">
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${metric.tone}`}><metric.icon className="h-4 w-4" aria-hidden="true" /></div>
                <p className="text-2xl font-bold tabular-nums text-foreground">{metric.value}</p>
                <p className="mt-1 text-xs font-medium text-foreground">{metric.label}</p>
                <p className="text-[11px] text-muted-foreground">{metric.helper}</p>
              </CardContent>
            </Card>
          ))}
        </motion.section>

        <motion.section variants={fadeUp} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar serviços">
            {([
              ["all", `Todos (${diagnostics.length})`],
              ["attention", `Atenção (${report.totals.attention})`],
              ["unconfigured", `Não configurados (${report.totals.unconfigured})`],
            ] as const).map(([value, label]) => (
              <Button key={value} size="sm" variant={serviceFilter === value ? "default" : "ghost"} className="min-h-10 rounded-xl" onClick={() => setServiceFilter(value)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <label className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-medium text-muted-foreground">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label="Atualização automática" />
              Autoatualizar
            </label>
            <Button size="sm" variant="outline" className="min-h-10 rounded-xl" onClick={copyReport}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
            <Button size="sm" variant="outline" className="min-h-10 rounded-xl" onClick={downloadReport}><Download className="mr-2 h-4 w-4" />JSON</Button>
          </div>
        </motion.section>

        {/* Overall status */}
        {checks.length > 0 && (
          <motion.div variants={fadeUp}>
            <Card role="status" aria-live="polite" className={`border-2 ${allOk ? "border-success/30 bg-success/5" : hasErrors ? "border-destructive/30 bg-destructive/5" : "border-amber-400/40 bg-amber-500/5"}`}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
                {allOk ? (
                  <CheckCircle2 className="w-14 h-14 text-success shrink-0" />
                ) : hasErrors ? (
                  <XCircle className="w-14 h-14 text-destructive shrink-0" />
                ) : (
                  <TriangleAlert className="w-14 h-14 text-amber-600 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-foreground">
                    {allOk ? "Todos os sistemas operacionais" : hasErrors ? `${failCount} serviço(s) com falha` : "Serviços operacionais com configuração pendente"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Latência média do núcleo: {avgLatency}ms · Checks do núcleo: {checks.filter(c => c.status === "ok").length}/{checks.length}
                  </p>
                </div>
                <Button asChild variant="ghost" className="min-h-11 justify-start sm:justify-center">
                  <Link to="/status" target="_blank" rel="noreferrer">
                    Ver página pública <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {hasErrors && (
          <motion.div variants={fadeUp} role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
            <TriangleAlert className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Ação operacional recomendada</p>
              <p className="text-sm text-muted-foreground">Confirme o serviço afetado abaixo. Se houver impacto ao atendimento, ative o modo manutenção e informe uma previsão de retorno.</p>
            </div>
            <Button asChild variant="destructive" className="min-h-11 shrink-0 rounded-xl">
              <Link to="/dashboard/admin/platform-settings">Abrir manutenção</Link>
            </Button>
          </motion.div>
        )}

        {/* Metadados operacionais fornecidos pelo servidor; nenhum secret é exposto. */}
        {operational && (
          <motion.div variants={fadeUp}>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Operação e recuperação</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <Globe className="w-5 h-5 text-primary mb-3" />
                  <p className="text-xs text-muted-foreground">Ambiente</p>
                  <p className="font-semibold capitalize">{operational.environment === "unknown" ? "Não identificado" : operational.environment}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <GitCommitHorizontal className="w-5 h-5 text-primary mb-3" />
                  <p className="text-xs text-muted-foreground">Versão implantada</p>
                  <p className="font-mono font-semibold" title="Identificador abreviado por segurança">{shortRelease(operational.release)}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <HardDrive className="w-5 h-5 text-primary mb-3" />
                  <p className="text-xs text-muted-foreground">Buckets privados/públicos</p>
                  <p className="font-semibold">{operational.storage.bucketCount ?? "Indisponível"}</p>
                </CardContent>
              </Card>
              <Card className={`border ${backupState === "healthy" ? "border-success/20" : backupState === "failed" || backupState === "never" ? "border-destructive/30" : "border-border"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Archive className={`w-5 h-5 mb-3 ${backupPresentation.tone}`} />
                    <Badge variant={backupPresentation.variant} className="text-[10px]">{backupPresentation.badge}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Backup operacional</p>
                  <p className="font-semibold text-sm">{backupPresentation.label}</p>
                  {operational.backup.lastCompleted?.occurredAt && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Último sucesso: {format(new Date(operational.backup.lastCompleted.occurredAt), "dd/MM/yyyy HH:mm")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* Serviços externos — VERIFICAÇÃO REAL (via edge function service-health) */}
        {(health.services.length > 0 || health.loading || health.error) && (
          <motion.div variants={fadeUp}>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Globe className="w-4 h-4" /> Serviços externos {health.mode === "browser" ? "(verificação básica)" : "(verificação real)"}
              </p>
              {health.services.length > 0 && (
                <Badge variant={health.summary.down === 0 ? "default" : "destructive"} className="text-[10px] h-5">
                  {health.summary.ok}/{health.summary.total}
                </Badge>
              )}
            </div>
            {health.loading && health.services.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">Verificando serviços…</p>
            ) : health.error && health.services.length === 0 ? (
              <p className="text-xs text-destructive px-1">Não foi possível verificar: {health.error}</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {health.services.filter((service) => serviceFilter === "all" || (serviceFilter === "attention" && service.status === "down") || (serviceFilter === "unconfigured" && service.status === "unconfigured")).map((s) => {
                  const icon = ({
                    database: <Database className="w-5 h-5" />, whatsapp: <MessageCircle className="w-5 h-5" />,
                    email: <Mail className="w-5 h-5" />, video: <Video className="w-5 h-5" />,
                    kyc: <Shield className="w-5 h-5" />, payments: <CreditCard className="w-5 h-5" />,
                    nfse: <FileText className="w-5 h-5" />,
                  } as Record<string, React.ReactNode>)[s.key] ?? <Plug className="w-5 h-5" />;
                  const tone = s.status === "ok"
                    ? "bg-success/10 text-success" : s.status === "down"
                    ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
                  const border = s.status === "ok" ? "border-success/20" : s.status === "down" ? "border-destructive/30" : "border-border";
                  return (
                    <Card key={s.key} className={`border ${border}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>{icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground text-sm truncate">{s.label}</p>
                              <Badge variant={s.status === "ok" ? "default" : s.status === "down" ? "destructive" : "secondary"} className="text-[10px] h-5 shrink-0">
                                {s.status === "ok" ? "ATIVO" : s.status === "down" ? "FALHA" : "NÃO CONFIG."}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {s.detail}{s.latencyMs ? ` • ${s.latencyMs}ms` : ""}
                            </p>
                            {s.critical && <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Serviço crítico</p>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            {health.mode === "browser" && health.services.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2 px-1">
                Verificação básica pelo navegador. A verificação completa no servidor
                (WhatsApp, e-mail, pagamentos, NFS-e) liga após publicar a função <code>service-health</code>.
              </p>
            )}
          </motion.div>
        )}

        {/* Service checks agrupados */}
        {([
          { key: "core", label: "🧱 Núcleo Supabase", icon: <Database className="w-4 h-4" /> },
          { key: "vps", label: "🖥️ Servidores VPS", icon: <Server className="w-4 h-4" /> },
          { key: "integration", label: "🔌 Edge Functions (deploy)", icon: <Plug className="w-4 h-4" /> },
        ] as const).map((section) => {
          const items = checks.filter((c) => (c.group ?? "core") === section.key && (serviceFilter === "all" || (serviceFilter === "attention" && c.status === "error")));
          if (items.length === 0) return null;
          const okCount = items.filter((c) => c.status === "ok").length;
          return (
            <motion.div key={section.key} variants={fadeUp}>
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  {section.icon} {section.label}
                </p>
                <Badge variant={okCount === items.length ? "default" : "destructive"} className="text-[10px] h-5">
                  {okCount}/{items.length}
                </Badge>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {items.map((check, i) => (
                  <Card key={`${section.key}-${i}`} className={`border ${check.status === "ok" ? "border-success/20" : "border-destructive/30"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          check.status === "ok" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                        }`}>
                          {check.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground text-sm truncate">{check.name}</p>
                            <Badge variant={check.status === "ok" ? "default" : "destructive"} className="text-[10px] h-5 shrink-0">
                              {check.status === "ok" ? "ATIVO" : "FALHA"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.message}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          );
        })}

        {filteredDiagnostics.length === 0 && !running && (
          <motion.div variants={fadeUp} className="rounded-2xl border border-dashed border-border p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-foreground">Nenhum serviço neste filtro</p>
            <p className="mt-1 text-xs text-muted-foreground">Altere o filtro para consultar o inventário completo.</p>
          </motion.div>
        )}

        {/* DB Stats */}
        {dbStats && (
          <motion.div variants={fadeUp}>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">📊 Estatísticas do Banco</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {dbStatCards.map((stat) => (
                <Card key={stat.label} className="border-border/50">
                  <CardContent className="p-4 text-center">
                    <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {dbStatsError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4" role="alert">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">Estatísticas indisponíveis</p>
                <p className="mt-1 text-xs text-muted-foreground">Os serviços foram verificados, mas não foi possível carregar as contagens do banco. Tente novamente.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {checks.length === 0 && !running && (
          <Card className="border-border">
            <CardContent className="py-12 text-center">
              <Server className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">Clique em "Verificar" para iniciar o diagnóstico.</p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </DashboardLayout>
  );
};

export default SystemHealth;
