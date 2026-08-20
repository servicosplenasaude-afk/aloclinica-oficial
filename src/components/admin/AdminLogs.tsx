import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAdminNav } from "./adminNav";
import { AdminPageHeader } from "./AdminPageHeader";
import {
  Search, History, ChevronLeft, ChevronRight, Download, RefreshCw, Eye, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDebounce } from "@/hooks/use-debounce";
import { exportToCSV } from "@/lib/csv";
import { toast } from "sonner";
import type { AuditLog } from "@/types/domain";
import { collectServerPages } from "@/lib/admin-pagination";

const PAGE_SIZE = 30;
const EXPORT_LIMIT = 50_000;

const entityColor: Record<string, string> = {
  patient: "bg-primary/10 text-primary",
  doctor: "bg-secondary/10 text-secondary",
  clinic: "bg-accent text-accent-foreground",
  appointment: "bg-destructive/10 text-destructive",
  plan: "bg-primary/10 text-primary",
  subscription: "bg-secondary/10 text-secondary",
  payment: "bg-emerald-500/10 text-emerald-700",
  kyc: "bg-blue-500/10 text-blue-700",
  user: "bg-purple-500/10 text-purple-700",
  system: "bg-slate-500/10 text-slate-700",
};

const PERIODS = [
  { value: "24h", label: "Últimas 24h", hours: 24 },
  { value: "7d", label: "7 dias", hours: 24 * 7 },
  { value: "30d", label: "30 dias", hours: 24 * 30 },
  { value: "90d", label: "90 dias (limite — mais antigos vão pra archive)", hours: 24 * 90 },
  { value: "all", label: "Tudo", hours: 0 },
];

const AdminLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [period, setPeriod] = useState("7d");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);

    let q = db.from("activity_logs").select("*", { count: "exact" }).order("created_at", { ascending: false });

    // Filtro por período
    const periodCfg = PERIODS.find(p => p.value === period);
    if (periodCfg && periodCfg.hours > 0) {
      const since = new Date(Date.now() - periodCfg.hours * 3600000).toISOString();
      q = q.gte("created_at", since);
    }

    // Filtro entity_type
    if (filterEntity !== "all") {
      q = q.eq("entity_type", filterEntity);
    }
    // Filtro action (LIKE)
    if (filterAction !== "all") {
      q = q.ilike("action", `%${filterAction}%`);
    }
    // Busca full-text simples em action OR entity_type OR entity_id
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.trim();
      q = q.or(`action.ilike.%${term}%,entity_type.ilike.%${term}%`);
    }

    // Paginação server-side
    q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, error, count } = await q;
    if (error) {
      toast.error("Erro ao carregar logs", { description: error.message });
    }
    setLogs((data ?? []) as AuditLog[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [debouncedSearch, filterEntity, filterAction, period, page]);

  // Reset page quando filtros mudam
  useEffect(() => { setPage(0); }, [debouncedSearch, filterEntity, filterAction, period]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));

  // Sugestões de ação populares (descobertas dos últimos logs)
  const actionSuggestions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      const prefix = l.action.split("_")[0];
      if (prefix) set.add(prefix);
    });
    return ["all", ...Array.from(set).sort()];
  }, [logs]);

  const exportCSV = async () => {
    const data = await collectServerPages<any>(async (from, to) => {
      if (from >= EXPORT_LIMIT) return [];
      let q = db.from("activity_logs").select("*").order("created_at", { ascending: false });
      const periodCfg = PERIODS.find(p => p.value === period);
      if (periodCfg && periodCfg.hours > 0) q = q.gte("created_at", new Date(Date.now() - periodCfg.hours * 3600000).toISOString());
      if (filterEntity !== "all") q = q.eq("entity_type", filterEntity);
      if (filterAction !== "all") q = q.ilike("action", `%${filterAction}%`);
      if (debouncedSearch.trim()) {
        const term = debouncedSearch.trim();
        q = q.or(`action.ilike.%${term}%,entity_type.ilike.%${term}%`);
      }
      const { data: pageData, error } = await q.range(from, Math.min(to, EXPORT_LIMIT - 1));
      if (error) throw error;
      return pageData ?? [];
    }, 500).catch((error) => {
      toast.error("Falha ao exportar logs", { description: error instanceof Error ? error.message : undefined });
      return [];
    });
    if (!data || data.length === 0) {
      toast.error("Nada para exportar");
      return;
    }
    exportToCSV(
      `activity_logs_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`,
      data.map((l: any) => ({
        data: format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss"),
        acao: l.action,
        tipo: l.entity_type,
        entity_id: l.entity_id ?? "",
        user_id: l.user_id ?? "",
        detalhes: l.metadata ? JSON.stringify(l.metadata) : "",
      })),
      [
        { key: "data", label: "Data" },
        { key: "acao", label: "Ação" },
        { key: "tipo", label: "Tipo" },
        { key: "entity_id", label: "Entity ID" },
        { key: "user_id", label: "User ID" },
        { key: "detalhes", label: "Detalhes" },
      ],
    );
    toast.success(`${data.length} logs exportados`);
    if ((total ?? 0) > EXPORT_LIMIT) toast.warning(`Exportação limitada explicitamente aos ${EXPORT_LIMIT.toLocaleString("pt-BR")} eventos mais recentes. Reduza o período para exportar o restante.`);
  };

  return (
    <DashboardLayout title="Administração" nav={getAdminNav("logs")}>
      <div className="space-y-5 pb-24 md:pb-6">
        <AdminPageHeader
          icon={History}
          eyebrow="Sistema"
          title="Histórico de Atividades"
          description={`${total ?? "..."} eventos no filtro atual. Logs > 90 dias são movidos para arquivo automaticamente.`}
          accent="from-slate-500 to-slate-700"
          actions={
            <>
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-1.5">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                <Download className="w-4 h-4" /> CSV (máx. 50 mil)
              </Button>
            </>
          }
        />

        {/* Filtros */}
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Busca: ação, tipo ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                {Object.keys(entityColor).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Prefixo de ação" /></SelectTrigger>
              <SelectContent>
                {actionSuggestions.map(a => (
                  <SelectItem key={a} value={a}>{a === "all" ? "Todas ações" : a + "_*"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="w-[150px]">Data</TableHead>
                  <TableHead scope="col">Ação</TableHead>
                  <TableHead scope="col">Tipo</TableHead>
                  <TableHead scope="col" className="hidden lg:table-cell">Entity ID</TableHead>
                  <TableHead scope="col" className="hidden md:table-cell">Detalhes</TableHead>
                  <TableHead scope="col" className="text-right">—</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      Nenhum log encontrado para os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : logs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {format(new Date(l.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium text-foreground text-sm">{l.action}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${entityColor[l.entity_type] ?? ""}`}>
                        {l.entity_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground font-mono">
                      {l.entity_id ? l.entity_id.slice(0, 12) + "…" : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">
                      {l.metadata ? JSON.stringify(l.metadata).slice(0, 80) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetail(l)} aria-label="Ver detalhes">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Paginação */}
            {(total ?? 0) > PAGE_SIZE && (
              <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total ?? 0)} de {total}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs px-2 tabular-nums">{page + 1} / {totalPages}</span>
                  <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalhe */}
        <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do log</DialogTitle>
            </DialogHeader>
            {detail && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground text-xs">Data:</span><br/>{format(new Date(detail.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</div>
                  <div><span className="text-muted-foreground text-xs">Ação:</span><br/><strong>{detail.action}</strong></div>
                  <div><span className="text-muted-foreground text-xs">Tipo:</span><br/>{detail.entity_type}</div>
                  <div><span className="text-muted-foreground text-xs">Entity ID:</span><br/><code className="text-[10px]">{detail.entity_id || "—"}</code></div>
                  {(detail as any).user_id && (
                    <div className="col-span-2"><span className="text-muted-foreground text-xs">User ID:</span><br/><code className="text-[10px]">{(detail as any).user_id}</code></div>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Payload:</span>
                  <pre className="mt-1 p-3 rounded bg-muted text-[11px] overflow-x-auto font-mono">
                    {detail.metadata ? JSON.stringify(detail.metadata, null, 2) : "(vazio)"}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminLogs;
