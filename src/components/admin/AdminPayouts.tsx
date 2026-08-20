import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getAdminNav } from "@/components/admin/adminNav";
import { db } from "@/integrations/supabase/untyped";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet, CheckCircle2, Copy, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/csv";
import { useConfirm } from "@/components/ui/confirm-dialog";
// UI: standardized empty-state block
import { AdminEmpty } from "@/components/admin/AdminStateBlocks";
import { ADMIN_PAGE_SIZE, collectServerPages, pageRange } from "@/lib/admin-pagination";

const STATUSES = ["pending", "ready", "paid", "disputed", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

const statusColor: Record<Status, string> = {
  pending: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
  paid: "bg-blue-100 text-blue-700",
  disputed: "bg-red-100 text-red-700",
  cancelled: "bg-muted text-muted-foreground",
};

// Campos de data disponíveis para o filtro de intervalo.
type DateField = "release_at" | "created_at";

const AdminPayouts = () => {
  const [tab, setTab] = useState<Status>("ready");
  const [page, setPage] = useState(0);
  const [txMap, setTxMap] = useState<Record<string, string>>({});
  // Filtros
  const [search, setSearch] = useState("");
  const [dateField, setDateField] = useState<DateField>("release_at");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  // Lote
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [batchRef, setBatchRef] = useState("");
  const qc = useQueryClient();
  const confirm = useConfirm();

  useEffect(() => setPage(0), [dateField, dateFrom, dateTo, minAmount, maxAmount]);

  const { data: payoutResult, isLoading } = useQuery({
    queryKey: ["admin-payouts", tab, page, dateField, dateFrom, dateTo, minAmount, maxAmount],
    queryFn: async () => {
      const { from, to } = pageRange(page);
      let query = db
        .from("doctor_payouts")
        .select("id, doctor_id, appointment_id, gross_amount, platform_fee, net_amount, status, release_at, paid_at, pix_key, pix_tx_id, created_at, doctor_profiles!inner(user_id, crm, crm_state, profiles!inner(first_name, last_name, cpf))", { count: "exact" })
        .eq("status", tab)
        .order("release_at", { ascending: true });
      if (dateFrom) query = query.gte(dateField, `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte(dateField, `${dateTo}T23:59:59.999`);
      if (minAmount.trim()) query = query.gte("net_amount", Number(minAmount));
      if (maxAmount.trim()) query = query.lte("net_amount", Number(maxAmount));
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { rows: data || [], count: count ?? 0 };
    },
  });
  const payouts = useMemo(() => payoutResult?.rows ?? [], [payoutResult?.rows]);
  const payoutCount = payoutResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(payoutCount / ADMIN_PAGE_SIZE));

  const doctorName = (p: any) => {
    const dr = p.doctor_profiles?.profiles;
    return `${dr?.first_name ?? ""} ${dr?.last_name ?? ""}`.trim();
  };

  // Datas e valores já são filtrados no servidor; nome é refinado na página atual.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (payouts as any[]).filter((p) => {
      if (term && !doctorName(p).toLowerCase().includes(term)) return false;
      return true;
    });
  }, [payouts, search]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, p) => ({
          count: acc.count + 1,
          gross: acc.gross + Number(p.gross_amount || 0),
          net: acc.net + Number(p.net_amount || 0),
        }),
        { count: 0, gross: 0, net: 0 }
      ),
    [filtered]
  );

  // Seleção limitada às linhas atualmente visíveis (filtro + status).
  const selectedRows = useMemo(() => filtered.filter((p) => selected[p.id]), [filtered, selected]);
  const selectedTotal = useMemo(
    () => selectedRows.reduce((acc, p) => acc + Number(p.net_amount || 0), 0),
    [selectedRows]
  );
  const readyRows = useMemo(() => filtered.filter((p) => p.status === "ready"), [filtered]);

  // Núcleo idempotente reutilizado pela marcação individual e em lote.
  // Idempotente: só marca um repasse que ainda NÃO foi pago (pending/ready).
  // Evita re-marcar/duplicar um repasse que o fluxo automático de saque já pagou.
  const markPaidCore = async (id: string, tx: string): Promise<"ok" | "noop" | "error"> => {
    const { data, error } = await db.functions.invoke("admin-confirm-payout", {
      body: { payout_id: id, transaction_id: tx, confirmation_source: "external_statement_verified" },
    });
    if (error) { toast.error("Não foi possível confirmar o repasse no servidor."); return "error"; }
    if (!data?.ok) return "noop";
    return "ok";
  };

  const markPaid = async (id: string) => {
    const tx = txMap[id]?.trim();
    if (!tx) { toast.error("Informe o ID da transação PIX"); return; }
    const approved = await confirm({
      title: "Confirmar pagamento externo?",
      description: "Confirme somente após conferir o identificador no extrato do provedor. A ação será registrada na auditoria.",
      confirmLabel: "Extrato conferido — confirmar",
    });
    if (!approved) return;
    const res = await markPaidCore(id, tx);
    if (res === "noop") { toast.error("Repasse já estava pago ou cancelado — nada foi alterado."); return; }
    if (res === "ok") {
      toast.success("Repasse marcado como pago");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    }
  };

  const markBatchPaid = async () => {
    const rows = selectedRows;
    if (rows.length === 0) { toast.error("Selecione ao menos um repasse"); return; }
    const ref = batchRef.trim();
    if (!ref) { toast.error("Informe a referência/ID PIX do lote"); return; }
    const ok = await confirm({
      title: "Marcar lote como pago?",
      description: `${rows.length} repasse(s) · R$ ${selectedTotal.toFixed(2)} serão marcados como pagos. Repasses já pagos/cancelados são ignorados.`,
      confirmLabel: "Marcar como pago",
    });
    if (!ok) return;
    let paid = 0, skipped = 0, failed = 0;
    for (const p of rows) {
      // Reutiliza o mesmo guard atômico/idempotente por linha; ref do lote como fallback do tx individual.
      const tx = txMap[p.id]?.trim() || ref;
      const res = await markPaidCore(p.id, tx);
      if (res === "ok") paid++; else if (res === "noop") skipped++; else failed++;
    }
    qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    setSelected({});
    toast.success(
      `${paid} pago(s)` +
      (skipped ? `, ${skipped} ignorado(s)` : "") +
      (failed ? `, ${failed} com erro` : "")
    );
  };

  const exportBatchCSV = async () => {
    let rows = selectedRows;
    if (rows.length === 0) {
      try {
        rows = await collectServerPages<any>(async (from, to) => {
          let query = db
            .from("doctor_payouts")
            .select("id, doctor_id, appointment_id, gross_amount, platform_fee, net_amount, status, release_at, paid_at, pix_key, pix_tx_id, created_at, doctor_profiles!inner(user_id, crm, crm_state, profiles!inner(first_name, last_name, cpf))")
            .eq("status", "ready")
            .order("release_at", { ascending: true });
          if (dateFrom) query = query.gte(dateField, `${dateFrom}T00:00:00`);
          if (dateTo) query = query.lte(dateField, `${dateTo}T23:59:59.999`);
          if (minAmount.trim()) query = query.gte("net_amount", Number(minAmount));
          if (maxAmount.trim()) query = query.lte("net_amount", Number(maxAmount));
          const { data, error } = await query.range(from, to);
          if (error) throw error;
          return (data ?? []) as any[];
        });
        const term = search.trim().toLowerCase();
        if (term) rows = rows.filter((p) => doctorName(p).toLowerCase().includes(term));
      } catch {
        toast.error("Não foi possível carregar todos os repasses para exportação");
        return;
      }
    }
    if (rows.length === 0) { toast.error("Nenhum repasse para exportar"); return; }
    exportToCSV(
      `lote_pix_${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((p) => ({
        medico: doctorName(p) || "—",
        documento: p.doctor_profiles?.profiles?.cpf ?? "",
        pix_key: p.pix_key ?? "",
        net_amount: Number(p.net_amount || 0).toFixed(2),
        appointment_id: p.appointment_id ?? "",
        payout_id: p.id,
      })),
      [
        { key: "medico", label: "Médico" },
        { key: "documento", label: "CPF/CNPJ" },
        { key: "pix_key", label: "Chave PIX" },
        { key: "net_amount", label: "Valor líquido" },
        { key: "appointment_id", label: "Consulta (ref)" },
        { key: "payout_id", label: "ID Repasse" },
      ]
    );
  };

  const selectAllReady = () => {
    setSelected((prev) => {
      const next = { ...prev };
      readyRows.forEach((p) => { next[p.id] = true; });
      return next;
    });
  };

  return (
    <DashboardLayout title="Repasses Médicos" nav={getAdminNav("payouts")}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Repasses</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Totais do filtro/status atual */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Repasses ({tab})</p>
                <p className="text-2xl font-bold">{payoutCount}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Bruto nesta página</p>
                <p className="text-2xl font-bold">R$ {totals.gross.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border p-4 bg-emerald-50/40">
                <p className="text-xs text-muted-foreground">Líquido nesta página</p>
                <p className="text-2xl font-bold text-emerald-700">R$ {totals.net.toFixed(2)}</p>
              </div>
            </div>

            {/* Filtros */}
            <div className="rounded-lg border p-4 mb-4 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Médico</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar nesta página" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Select value={dateField} onValueChange={(v) => setDateField(v as DateField)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="release_at">Liberação</SelectItem>
                    <SelectItem value="created_at">Criação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs">Líquido mín.</Label>
                <Input type="number" inputMode="decimal" placeholder="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="w-28" />
              </div>
              <div>
                <Label className="text-xs">Líquido máx.</Label>
                <Input type="number" inputMode="decimal" placeholder="0" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="w-28" />
              </div>
              {(search || dateFrom || dateTo || minAmount || maxAmount) && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setMinAmount(""); setMaxAmount(""); }}>
                  Limpar filtros
                </Button>
              )}
            </div>

            <Tabs value={tab} onValueChange={(v) => { setTab(v as Status); setPage(0); setSelected({}); }}>
              <TabsList className="grid grid-cols-5 w-full">
                {STATUSES.map((s) => <TabsTrigger key={s} value={s} className="capitalize">{s}</TabsTrigger>)}
              </TabsList>
              <TabsContent value={tab} className="mt-4 space-y-2">
                {/* Barra de ações em lote (payout run) */}
                {filtered.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 flex flex-wrap items-center gap-3">
                    <p className="text-sm">
                      <span className="font-medium">{selectedRows.length}</span> selecionado(s)
                      {selectedRows.length > 0 && <> · <span className="font-semibold text-emerald-700">R$ {selectedTotal.toFixed(2)}</span></>}
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={selectAllReady} disabled={readyRows.length === 0}>
                      Selecionar todos os prontos
                    </Button>
                    {selectedRows.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSelected({})}>
                        Limpar seleção
                      </Button>
                    )}
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <Input placeholder="Ref./ID PIX do lote" className="h-8 w-44"
                        value={batchRef} onChange={(e) => setBatchRef(e.target.value)} />
                      <Button type="button" size="sm" onClick={markBatchPaid} disabled={selectedRows.length === 0}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar em lote como pago
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={exportBatchCSV}>
                        <Download className="h-4 w-4 mr-1" /> Exportar lote PIX (CSV)
                      </Button>
                    </div>
                  </div>
                )}

                {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p>
                : filtered.length === 0 ? <AdminEmpty icon={Wallet} title={`Nenhum repasse ${tab}`} description="Não há repasses com este status/filtro no momento." />
                : filtered.map((p) => {
                    const dr = p.doctor_profiles?.profiles;
                    return (
                      <div key={p.id} className="rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            className="mt-1"
                            aria-label="Selecionar repasse"
                            checked={!!selected[p.id]}
                            onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [p.id]: v === true }))}
                          />
                          <div>
                            <p className="font-medium">Dr(a). {dr?.first_name} {dr?.last_name}</p>
                            <p className="text-xs text-muted-foreground">CRM {p.doctor_profiles?.crm}/{p.doctor_profiles?.crm_state} · liberado em {format(new Date(p.release_at), "dd/MM/yyyy")}</p>
                            {p.pix_key && (
                              <p className="text-xs flex items-center gap-1 mt-1">
                                <span className="text-muted-foreground">PIX:</span> <code className="bg-muted px-1 rounded">{p.pix_key}</code>
                                <button type="button" aria-label="Copiar chave PIX" onClick={() => { navigator.clipboard.writeText(p.pix_key); toast.success("PIX copiado"); }} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Copy className="h-3 w-3" /></button>
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold">R$ {Number(p.net_amount).toFixed(2)}</p>
                            <p className="text-[10px] text-muted-foreground">bruto R$ {Number(p.gross_amount).toFixed(2)} · taxa R$ {Number(p.platform_fee).toFixed(2)}</p>
                          </div>
                          <Badge className={statusColor[p.status as Status]}>{p.status}</Badge>
                          {p.status === "ready" && (
                            <div className="flex items-center gap-1">
                              <Input placeholder="ID transação PIX" className="h-8 w-44"
                                value={txMap[p.id] || ""} onChange={(e) => setTxMap({ ...txMap, [p.id]: e.target.value })} />
                              <Button size="sm" onClick={() => markPaid(p.id)}><CheckCircle2 className="h-4 w-4 mr-1" /> Pago</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                <div className="flex items-center justify-between border-t pt-3 mt-3">
                  <p className="text-xs text-muted-foreground">Página {page + 1} de {totalPages} · {payoutCount} registro(s)</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0 || isLoading} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminPayouts;
