/**
 * AdminCompliance — Painel de Compliance (CFM 2.314/2022 + LGPD)
 *
 * Permite ao admin:
 *  - Visualizar e exportar evidências de TCLE (consent_logs)
 *  - Consultar logs imutáveis de auditoria (activity_logs)
 *  - Verificar status de retenção do prontuário (medical_records.retention_until)
 *
 * Exports em CSV para anexar a auditorias do CRM / ANPD.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getAdminNav } from "./adminNav";
import { AdminPageHeader } from "./AdminPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShieldCheck, Download, RefreshCw, FileSignature, History,
  Archive, CheckCircle, AlertTriangle,
} from "lucide-react";
import { collectServerPages } from "@/lib/admin-pagination";

const adminNav = getAdminNav("compliance");
const COMPLIANCE_EXPORT_LIMIT = 50_000;
const COMPLIANCE_VIEW_LIMIT = 5_000;

type Consent = {
  id: string; user_id: string | null; consent_type: string; version: string | null;
  accepted: boolean; ip_address: string | null; user_agent: string | null;
  document_url: string | null; metadata: any; created_at: string;
};
type Log = {
  id: string; user_id: string | null; action: string; entity_type: string | null;
  entity_id: string | null; ip_address: string | null; user_agent: string | null;
  metadata: any; created_at: string;
};
type Record = {
  id: string; patient_id: string | null; doctor_id: string | null;
  appointment_id: string | null; record_type: string | null;
  is_draft: boolean | null; locked_at: string | null;
  retention_until: string | null; created_at: string; updated_at: string;
};

const fmt = (d?: string | null) =>
  d ? format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";

function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}
function downloadCSV(filename: string, rows: any[]) {
  if (!rows.length) { toast.info("Nenhum dado para exportar"); return; }
  const blob = new Blob(["\ufeff" + toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`${rows.length} registros exportados`);
}

export default function AdminCompliance() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [records, setRecords] = useState<Record[]>([]);

  const fromISO = useMemo(() => new Date(`${from}T00:00:00`).toISOString(), [from]);
  const toISO = useMemo(() => new Date(`${to}T23:59:59`).toISOString(), [to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, l, r] = await Promise.all([
        loadComplianceView("consent_logs", "*", fromISO, toISO),
        loadComplianceView("activity_logs", "*", fromISO, toISO),
        loadComplianceView("medical_records", "id,patient_id,doctor_id,appointment_id,record_type,is_draft,locked_at,retention_until,created_at,updated_at", fromISO, toISO),
      ]);
      setConsents(c as Consent[]);
      setLogs(l as Log[]);
      setRecords(r as Record[]);
    } catch (e: any) {
      toast.error("Erro ao carregar dados", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [fromISO, toISO]);

  useEffect(() => { load(); }, [load]);

  // Métricas
  const consentStats = useMemo(() => {
    const accepted = consents.filter(c => c.accepted).length;
    const rejected = consents.length - accepted;
    const tcle = consents.filter(c => c.consent_type?.toLowerCase().includes("tcle")).length;
    return { total: consents.length, accepted, rejected, tcle };
  }, [consents]);

  const retentionStats = useMemo(() => {
    const now = Date.now();
    const in20y = records.filter(r => r.retention_until && new Date(r.retention_until).getTime() > now).length;
    const expired = records.filter(r => r.retention_until && new Date(r.retention_until).getTime() <= now).length;
    const missing = records.filter(r => !r.retention_until).length;
    const locked = records.filter(r => r.locked_at).length;
    return { total: records.length, in20y, expired, missing, locked };
  }, [records]);

  return (
    <DashboardLayout title="Compliance" nav={adminNav}>
      <AdminPageHeader
        icon={ShieldCheck}
        title="Painel de Compliance"
        description="Evidências de TCLE, logs imutáveis e retenção do prontuário (CFM 2.314/2022 · LGPD)"
      />

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
          </div>
          <Button onClick={load} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <div className="ml-auto flex gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Visualização: máx. 5.000/aba</Badge>
            <Badge variant="outline">TCLE: {consentStats.tcle}</Badge>
            <Badge variant="outline">Logs: {logs.length}</Badge>
            <Badge variant="outline">Prontuários: {records.length}</Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="tcle" className="w-full">
        <TabsList>
          <TabsTrigger value="tcle"><FileSignature className="w-4 h-4 mr-1" />TCLE & Consentimentos</TabsTrigger>
          <TabsTrigger value="logs"><History className="w-4 h-4 mr-1" />Logs Imutáveis</TabsTrigger>
          <TabsTrigger value="retention"><Archive className="w-4 h-4 mr-1" />Retenção Prontuário</TabsTrigger>
        </TabsList>

        {/* TCLE */}
        <TabsContent value="tcle">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline" className="text-emerald-700 border-emerald-200">
                    <CheckCircle className="w-3 h-3 mr-1" /> Aceitos: {consentStats.accepted}
                  </Badge>
                  <Badge variant="outline" className="text-rose-700 border-rose-200">
                    Recusados: {consentStats.rejected}
                  </Badge>
                </div>
                <Button size="sm" variant="outline" onClick={async () => downloadCSV(`tcle_${from}_${to}.csv`, await loadComplianceExport("consent_logs", fromISO, toISO))}>
                  <Download className="w-4 h-4 mr-1" />Exportar CSV (máx. 50 mil)
                </Button>
              </div>
              <div className="overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Data/Hora</TableHead>
                      <TableHead scope="col">Usuário</TableHead>
                      <TableHead scope="col">Tipo</TableHead>
                      <TableHead scope="col">Versão</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consents.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{fmt(c.created_at)}</TableCell>
                        <TableCell className="text-xs font-mono">{c.user_id?.slice(0, 8) ?? "—"}</TableCell>
                        <TableCell className="text-xs">{c.consent_type}</TableCell>
                        <TableCell className="text-xs">{c.version ?? "—"}</TableCell>
                        <TableCell>
                          {c.accepted
                            ? <Badge variant="outline" className="text-emerald-700 border-emerald-200">Aceito</Badge>
                            : <Badge variant="outline" className="text-rose-700 border-rose-200">Recusado</Badge>}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{c.ip_address ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {!consents.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum consentimento no período</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  Logs append-only — UPDATE/DELETE bloqueados via trigger (CFM 2.314/2022 Art. 5º)
                </p>
                <Button size="sm" variant="outline" onClick={async () => downloadCSV(`auditlog_${from}_${to}.csv`, await loadComplianceExport("activity_logs", fromISO, toISO))}>
                  <Download className="w-4 h-4 mr-1" />Exportar CSV (máx. 50 mil)
                </Button>
              </div>
              <div className="overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Data/Hora</TableHead>
                      <TableHead scope="col">Ação</TableHead>
                      <TableHead scope="col">Entidade</TableHead>
                      <TableHead scope="col">Usuário</TableHead>
                      <TableHead scope="col">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{fmt(l.created_at)}</TableCell>
                        <TableCell className="text-xs font-medium">{l.action}</TableCell>
                        <TableCell className="text-xs">{l.entity_type ?? "—"}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}</TableCell>
                        <TableCell className="text-xs font-mono">{l.user_id?.slice(0, 8) ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{l.ip_address ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {!logs.length && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum log no período</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retention */}
        <TabsContent value="retention">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 border rounded">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-semibold">{retentionStats.total}</p>
                </div>
                <div className="p-3 border rounded">
                  <p className="text-xs text-muted-foreground">Em retenção (20 anos)</p>
                  <p className="text-xl font-semibold text-emerald-600">{retentionStats.in20y}</p>
                </div>
                <div className="p-3 border rounded">
                  <p className="text-xs text-muted-foreground">Bloqueados (locked)</p>
                  <p className="text-xl font-semibold">{retentionStats.locked}</p>
                </div>
                <div className="p-3 border rounded">
                  <p className="text-xs text-muted-foreground">Expirados / sem data</p>
                  <p className="text-xl font-semibold text-amber-600">{retentionStats.expired + retentionStats.missing}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  Retenção mínima de 20 anos — CFM 1.821/2007 Art. 7º
                </p>
                <Button size="sm" variant="outline" onClick={async () => downloadCSV(`retention_${from}_${to}.csv`, await loadComplianceExport("medical_records", fromISO, toISO))}>
                  <Download className="w-4 h-4 mr-1" />Exportar CSV (máx. 50 mil)
                </Button>
              </div>
              <div className="overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Criado em</TableHead>
                      <TableHead scope="col">Tipo</TableHead>
                      <TableHead scope="col">Paciente</TableHead>
                      <TableHead scope="col">Médico</TableHead>
                      <TableHead scope="col">Bloqueado</TableHead>
                      <TableHead scope="col">Reter até</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map(r => {
                      const expired = r.retention_until && new Date(r.retention_until).getTime() <= Date.now();
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{fmt(r.created_at)}</TableCell>
                          <TableCell className="text-xs">{r.record_type ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.patient_id?.slice(0, 8) ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.doctor_id?.slice(0, 8) ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            {r.locked_at
                              ? <Badge variant="outline" className="text-emerald-700 border-emerald-200">Sim</Badge>
                              : <Badge variant="outline" className="text-amber-700 border-amber-200">Rascunho</Badge>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.retention_until ? (
                              <span className={expired ? "text-rose-600" : ""}>
                                {format(new Date(r.retention_until), "dd/MM/yyyy")}
                                {expired && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                              </span>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!records.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum prontuário no período</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

async function loadComplianceExport(table: "consent_logs" | "activity_logs" | "medical_records", fromISO: string, toISO: string) {
  return collectServerPages<any>(async (from, to) => {
    if (from >= COMPLIANCE_EXPORT_LIMIT) return [];
    const { data, error } = await db.from(table).select("*")
      .gte("created_at", fromISO).lte("created_at", toISO)
      .order("created_at", { ascending: false })
      .range(from, Math.min(to, COMPLIANCE_EXPORT_LIMIT - 1));
    if (error) throw error;
    return data ?? [];
  }, 500);
}

async function loadComplianceView(table: "consent_logs" | "activity_logs" | "medical_records", columns: string, fromISO: string, toISO: string) {
  return collectServerPages<any>(async (from, to) => {
    if (from >= COMPLIANCE_VIEW_LIMIT) return [];
    const { data, error } = await db.from(table).select(columns)
      .gte("created_at", fromISO).lte("created_at", toISO)
      .order("created_at", { ascending: false })
      .range(from, Math.min(to, COMPLIANCE_VIEW_LIMIT - 1));
    if (error) throw error;
    return data ?? [];
  }, 500);
}
