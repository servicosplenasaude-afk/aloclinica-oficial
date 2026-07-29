import { useEffect, useMemo, useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getAdminNav } from "@/components/admin/adminNav";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatBento, BentoItem } from "@/components/dashboards/StatBento";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminEmpty } from "@/components/admin/AdminStateBlocks";
import { FileText, FileCode, Filter, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Formatação BRL (pt-BR) ──
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type NFSeStatus = "processando" | "autorizado" | "erro_autorizacao" | "cancelado";

interface NFSeRow {
  id: string;
  ref: string;
  resource_type: "appointment" | "queue";
  resource_id: string;
  patient_id: string | null;
  valor: number | null;
  status: NFSeStatus;
  numero: string | null;
  codigo_verificacao: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  provider: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// Metadados de status: rótulo pt-BR + classe do badge (dark-mode aware, tokens do sistema)
const STATUS_META: Record<NFSeStatus, { label: string; badge: string }> = {
  autorizado: {
    label: "Autorizado",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  processando: {
    label: "Processando",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  erro_autorizacao: {
    label: "Erro na autorização",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
  cancelado: {
    label: "Cancelado",
    badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  },
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos os status" },
  { value: "autorizado", label: "Autorizado" },
  { value: "processando", label: "Processando" },
  { value: "erro_autorizacao", label: "Erro na autorização" },
  { value: "cancelado", label: "Cancelado" },
];

const resourceLabel = (t: NFSeRow["resource_type"]) => (t === "queue" ? "Plantão" : "Consulta");

const AdminNFSe = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<NFSeRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("todos");
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("nfse_invoices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      toast.error("Não foi possível carregar as notas fiscais.");
      setRows([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as NFSeRow[];

    // ── Nomes dos pacientes (profiles.user_id === patient_id) ──
    const ids = [...new Set(list.map((r) => r.patient_id).filter(Boolean))] as string[];
    const nameMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profs } = await db
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", ids);
      (profs ?? []).forEach((p: any) => {
        nameMap[p.user_id] = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
      });
    }

    setNames(nameMap);
    setRows(list);
    setLoading(false);
  };

  // ── Reprocessa / reemite a nota (idempotente por ref) ──
  const reprocess = async (row: NFSeRow) => {
    setReprocessingId(row.id);
    const { error } = await db.functions.invoke("emit-nfse", {
      body: { resource_type: row.resource_type, resource_id: row.resource_id },
    });
    setReprocessingId(null);
    if (error) {
      toast.error("Falha ao solicitar o reprocessamento.");
      return;
    }
    toast.success("Reprocessamento solicitado");
    fetchData();
  };

  // ── KPIs ──
  const kpis = useMemo(() => {
    const total = rows.length;
    const autorizado = rows.filter((r) => r.status === "autorizado").length;
    const processando = rows.filter((r) => r.status === "processando").length;
    const erro = rows.filter((r) => r.status === "erro_autorizacao").length;
    const somaAutorizadas = rows
      .filter((r) => r.status === "autorizado")
      .reduce((acc, r) => acc + Number(r.valor || 0), 0);
    return { total, autorizado, processando, erro, somaAutorizadas };
  }, [rows]);

  const filtered = useMemo(
    () => (statusFilter === "todos" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter]
  );

  const statItems: BentoItem[] = [
    {
      label: "Notas emitidas", value: kpis.total, icon: "🧾",
      iconBg: "bg-blue-50 dark:bg-blue-950/30", valueClass: "text-[#1255C8] dark:text-blue-400", accentClass: "bg-blue-500",
      sub: "total no período",
    },
    {
      label: "Autorizadas", value: kpis.autorizado, icon: "✅",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/30", valueClass: "text-emerald-700 dark:text-emerald-400", accentClass: "bg-emerald-500",
      sub: "emitidas com sucesso",
    },
    {
      label: "Processando", value: kpis.processando, icon: "⏳",
      iconBg: "bg-amber-50 dark:bg-amber-950/30", valueClass: "text-amber-600 dark:text-amber-400", accentClass: "bg-amber-500",
      sub: "aguardando o provedor",
    },
    {
      label: "Com erro", value: kpis.erro, icon: "⚠️",
      iconBg: "bg-rose-50 dark:bg-rose-950/30", valueClass: "text-rose-700 dark:text-rose-400", accentClass: "bg-rose-500",
      sub: "falha na autorização",
    },
    {
      label: "Valor autorizado", value: brl.format(kpis.somaAutorizadas), icon: "💰",
      iconBg: "bg-violet-50 dark:bg-violet-950/30", valueClass: "text-violet-700 dark:text-violet-400", accentClass: "bg-violet-500",
      sub: "soma das autorizadas",
    },
  ];

  return (
    <DashboardLayout title="Administração" nav={getAdminNav("nfse")}>
      <div className="w-full mx-auto max-w-6xl space-y-5 pb-24 md:pb-6">
        <AdminPageHeader
          icon={FileText}
          eyebrow="Operação"
          title="Notas Fiscais (NFS-e)"
          description="Acompanhe a emissão automática das notas fiscais de serviço de cada consulta e plantão pagos."
          accent="from-amber-500 to-orange-600"
          actions={
            rows.length > 0 ? (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[190px] h-9">
                  <Filter className="w-4 h-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : undefined
          }
        />

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[110px] animate-pulse rounded-2xl bg-muted/50 border border-border/10" />
              ))}
            </div>
            <div className="shimmer-v2 h-64 rounded-2xl" />
          </div>
        ) : rows.length === 0 ? (
          // ── Empty state acolhedor ──
          <Card className="border-border border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center gap-4 py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-amber-500" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h2 className="text-lg font-bold text-foreground">Nenhuma nota fiscal emitida ainda</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A emissão automática é ativada quando o contador configurar a Focus NFe (secrets NFSE_*).
                  Depois disso, cada consulta/plantão paga gera a nota aqui.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── KPIs ── */}
            <StatBento stats={statItems} />

            {/* ── Tabela de notas ── */}
            <Card className="border-border">
              <CardContent className="p-0">
                {filtered.length === 0 ? (
                  <AdminEmpty
                    icon={FileText}
                    title="Nenhuma nota com este status"
                    description="Ajuste o filtro acima para ver as demais notas fiscais."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Data</th>
                          <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Paciente</th>
                          <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Tipo</th>
                          <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Valor</th>
                          <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Nº</th>
                          <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Status</th>
                          <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((row) => {
                          const meta = STATUS_META[row.status] ?? STATUS_META.processando;
                          const patient = (row.patient_id && names[row.patient_id]) || "—";
                          return (
                            <tr key={row.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors align-top">
                              <td className="px-4 py-3 whitespace-nowrap text-foreground tabular-nums">
                                {format(new Date(row.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </td>
                              <td className="px-4 py-3 text-foreground max-w-[200px] truncate" title={patient}>
                                {patient}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                {resourceLabel(row.resource_type)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-foreground tabular-nums">
                                {brl.format(Number(row.valor || 0))}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                                {row.numero || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className={`font-semibold text-[11px] h-5 px-1.5 ${meta.badge}`}>
                                  {meta.label}
                                </Badge>
                                {row.status === "erro_autorizacao" && row.error && (
                                  <p
                                    className="mt-1 max-w-[220px] truncate text-[11px] text-rose-600 dark:text-rose-400"
                                    title={row.error}
                                  >
                                    {row.error}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1.5">
                                  {row.pdf_url && (
                                    <Button asChild variant="outline" size="sm" className="h-8">
                                      <a href={row.pdf_url} target="_blank" rel="noopener noreferrer">
                                        <FileText className="w-3.5 h-3.5 mr-1" /> Ver PDF
                                      </a>
                                    </Button>
                                  )}
                                  {row.xml_url && (
                                    <Button asChild variant="outline" size="sm" className="h-8">
                                      <a href={row.xml_url} target="_blank" rel="noopener noreferrer">
                                        <FileCode className="w-3.5 h-3.5 mr-1" /> XML
                                      </a>
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8"
                                    disabled={reprocessingId === row.id}
                                    onClick={() => reprocess(row)}
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${reprocessingId === row.id ? "animate-spin" : ""}`} />
                                    Reprocessar
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminNFSe;
