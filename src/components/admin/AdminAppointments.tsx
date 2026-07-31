import { useState, useEffect } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getAdminNav } from "./adminNav";
import { AdminPageHeader } from "./AdminPageHeader";
import { Search, Video, Clock, Download, MoreHorizontal, XCircle, CheckCircle2, UserCog, UserX, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDebounce } from "@/hooks/use-debounce";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { exportToCSV } from "@/lib/csv";
import { logError } from "@/lib/logger";
import type { AdminAppointmentRow } from "@/types/domain";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";

const statusLabel: Record<string, string> = {
  scheduled: "Agendada", waiting: "Esperando", in_progress: "Em andamento",
  completed: "Concluída", cancelled: "Cancelada", no_show: "Ausente",
  payment_pending: "Aguardando pgto.", confirmed: "Confirmada",
};
const statusVariant: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
  scheduled: "outline", waiting: "secondary", in_progress: "default",
  completed: "default", cancelled: "destructive", no_show: "destructive",
  payment_pending: "outline", confirmed: "secondary",
};
const typeLabel: Record<string, string> = {
  first_visit: "1ª Consulta", return: "Retorno", urgency: "Urgência",
};

// Colunas buscadas em appointments (reutilizado pela listagem e pelo export)
const APPT_SELECT = "id, scheduled_at, status, patient_id, doctor_id, duration_minutes, notes, appointment_type, price_at_booking, payment_status";

type DoctorOption = { id: string; name: string };

const AdminAppointments = () => {
  const confirm = useConfirm();
  const [appointments, setAppointments] = useState<AdminAppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSpecialty, setFilterSpecialty] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const [acting, setActing] = useState(false);
  // Reatribuição de médico
  const [reassignAppt, setReassignAppt] = useState<AdminAppointmentRow | null>(null);
  const [reassignLoading, setReassignLoading] = useState(false);
  const [candidates, setCandidates] = useState<DoctorOption[]>([]);
  const [candidatesFiltered, setCandidatesFiltered] = useState(true);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const pg = usePagination({ pageSize: 25 });

  useEffect(() => { fetchAppointments(); }, [pg.page, pg.pageSize, filterStatus, filterSpecialty, dateFrom, dateTo, debouncedSearch]);

  // Especialidades para o filtro
  useEffect(() => {
    (async () => {
      const { data } = await db.from("specialties").select("id, name").eq("is_active", true).order("name");
      setSpecialties(data ?? []);
    })();
  }, []);

  // Realtime updates
  useEffect(() => {
    const channel = db
      .channel("admin-appts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        fetchAppointments();
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, []);

  // Aplica filtros de servidor (status, período e especialidade) a uma query de appointments.
  // A especialidade resolve para os doctor_ids correspondentes antes de filtrar.
  const applyFilters = async (query: any) => {
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (dateFrom) query = query.gte("scheduled_at", dateFrom);
    if (dateTo) query = query.lte("scheduled_at", `${dateTo}T23:59:59`);
    if (filterSpecialty !== "all") {
      const { data: ds } = await db.from("doctor_specialties").select("doctor_id").eq("specialty_id", filterSpecialty);
      const ids = [...new Set((ds ?? []).map((r: any) => r.doctor_id))];
      // Sentinela quando nenhum médico tem a especialidade → retorna vazio em vez de todos
      query = query.in("doctor_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }
    return query;
  };

  // Resolve nomes de paciente e médico para um lote de linhas de appointments.
  const resolveNames = async (data: any[]): Promise<AdminAppointmentRow[]> => {
    const patientIds = [...new Set(data.map(a => a.patient_id).filter((id): id is string => Boolean(id)))];
    const doctorIds = [...new Set(data.map(a => a.doctor_id))];
    const [pRes, dRes] = await Promise.all([
      patientIds.length > 0 ? db.from("profiles").select("user_id, first_name, last_name").in("user_id", patientIds) : { data: [] as any[] },
      db.from("doctor_profiles").select("id, user_id").in("id", doctorIds),
    ]);
    const pMap = new Map((pRes.data ?? []).map(p => [p.user_id, `${p.first_name} ${p.last_name}`]));
    const docUserIds = (dRes.data ?? []).map(d => d.user_id);
    const { data: docProfiles } = docUserIds.length > 0
      ? await db.from("profiles").select("user_id, first_name, last_name").in("user_id", docUserIds)
      : { data: [] };
    const docMap = new Map<string, string>();
    (dRes.data ?? []).forEach(d => {
      const p = docProfiles?.find(pr => pr.user_id === d.user_id);
      if (p) docMap.set(d.id, `${p.first_name} ${p.last_name}`);
    });
    return data.map(a => ({ ...a, patient_name: pMap.get(a.patient_id!) ?? "—", doctor_name: docMap.get(a.doctor_id) ?? "—" }));
  };

  const fetchAppointments = async () => {
    setLoading(true);
    let query = db.from("appointments")
      .select(APPT_SELECT, { count: "exact" })
      .order("scheduled_at", { ascending: false });
    query = await applyFilters(query);
    const { data, count } = await query.range(pg.from, pg.to);
    if (!data) { setLoading(false); return; }
    pg.setTotal(count ?? 0);

    // Realtime counts (rápidos, separados da paginação)
    const { count: liveC } = await db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "in_progress");
    const { count: waitingC } = await db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "waiting");
    setLiveCount(liveC ?? 0);
    setWaitingCount(waitingC ?? 0);

    setAppointments(await resolveNames(data));
    setLoading(false);
  };

  // Auditoria: registra cada ação administrativa em activity_logs (mesmo padrão de AdminUsers).
  const logAdminAction = async (action: string, entityId: string, metadata: Record<string, unknown>) => {
    try {
      const { data: authData } = await db.auth.getUser();
      const actorId = authData?.user?.id ?? null;
      await db.from("activity_logs").insert({
        user_id: actorId,
        action,
        entity_type: "appointment",
        entity_id: entityId,
        metadata: { actor_id: actorId, ...metadata },
      });
    } catch (e) {
      logError("AdminAppointments audit log write failed", e);
    }
  };

  // Atualiza status + campos extras, audita e refaz o fetch.
  const applyStatus = async (a: AdminAppointmentRow, status: string, action: string, extra: Record<string, unknown> = {}) => {
    setActing(true);
    const { error } = await db.from("appointments")
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq("id", a.id);
    if (error) {
      toast.error("Erro ao atualizar consulta", { description: error.message });
      setActing(false);
      return;
    }
    await logAdminAction(action, a.id, { previous_status: a.status, new_status: status });
    toast.success("Consulta atualizada ✅");
    setActing(false);
    fetchAppointments();
  };

  const cancelAppt = async (a: AdminAppointmentRow) => {
    const ok = await confirm({
      title: "Cancelar consulta?",
      description: "A consulta será marcada como Cancelada. Paciente e médico perdem o horário. Reembolsos, se houver, dependem de fluxo próprio.",
      confirmLabel: "Cancelar consulta",
      destructive: true,
    });
    if (!ok) return;
    const { data: authData } = await db.auth.getUser();
    await applyStatus(a, "cancelled", "appointment.cancel", {
      cancelled_by: authData?.user?.id ?? null,
      cancel_reason: "Cancelada pela administração",
    });
  };

  const forceComplete = async (a: AdminAppointmentRow) => {
    const ok = await confirm({
      title: "Forçar conclusão?",
      description: "Marca a consulta como Concluída. Use para consultas travadas em andamento.",
      confirmLabel: "Concluir",
    });
    if (!ok) return;
    await applyStatus(a, "completed", "appointment.complete", { ended_at: new Date().toISOString() });
  };

  const markNoShow = async (a: AdminAppointmentRow) => {
    const ok = await confirm({
      title: "Marcar falta?",
      description: "Marca o paciente como Ausente (no-show).",
      confirmLabel: "Marcar falta",
      destructive: true,
    });
    if (!ok) return;
    await applyStatus(a, "no_show", "appointment.no_show");
  };

  // Estorno REAL no Mercado Pago via edge function (valida a transação e devolve o
  // dinheiro de fato). A função marca a transação + o appointment como refunded.
  const refundAppt = async (a: AdminAppointmentRow) => {
    const ok = await confirm({
      title: "Estornar pagamento?",
      description: "Devolve o valor pago ao paciente pelo Mercado Pago (estorno total). A consulta fica marcada como reembolsada. Ação irreversível.",
      confirmLabel: "Estornar",
      destructive: true,
    });
    if (!ok) return;
    setActing(true);
    try {
      const { data, error } = await db.functions.invoke("mercadopago-refund", { body: { reference_id: `appointment_${a.id}` } });
      let errMsg: string | null = (data as { error?: string } | null)?.error ?? null;
      if (!errMsg && error) {
        errMsg = error.message;
        try { const b = await (error as { context?: Response }).context?.json?.(); if (b?.error) errMsg = b.error; } catch { /* ignora */ }
      }
      if ((data as { ok?: boolean } | null)?.ok) {
        const clawback = (data as { payout_clawback?: string } | null)?.payout_clawback;
        if (clawback === "already_withdrawn") {
          toast.warning("Estorno feito — atenção ao repasse", { description: "O paciente será reembolsado, mas o repasse ao médico já foi sacado. Ajuste o acerto com o médico manualmente." });
        } else {
          toast.success("Estorno realizado", { description: "Valor devolvido ao paciente; repasse do médico cancelado quando ainda pendente." });
        }
        fetchAppointments();
      } else if (errMsg && /já estornad|em processamento|em andamento/i.test(errMsg)) {
        toast.success("Estorno já processado");
        fetchAppointments();
      } else if (errMsg && /não encontrada/i.test(errMsg)) {
        toast.error("Sem pagamento para estornar", { description: "Esta consulta não tem transação de pagamento registrada." });
      } else {
        toast.error("Não foi possível estornar", { description: errMsg || "Tente novamente ou verifique no painel do Mercado Pago." });
      }
    } catch (e) {
      logError("AdminAppointments refund error", e);
      toast.error("Erro no estorno", { description: e instanceof Error ? e.message : "Tente novamente." });
    } finally {
      setActing(false);
    }
  };

  // Abre o diálogo de reatribuição e carrega médicos candidatos (mesma especialidade quando possível).
  const openReassign = async (a: AdminAppointmentRow) => {
    setReassignAppt(a);
    setSelectedDoctorId("");
    setCandidates([]);
    setCandidatesFiltered(true);
    setReassignLoading(true);

    const { data: mySpecs } = await db.from("doctor_specialties").select("specialty_id").eq("doctor_id", a.doctor_id);
    const specialtyIds = [...new Set((mySpecs ?? []).map((r: any) => r.specialty_id))];

    let peerIds: string[] = [];
    if (specialtyIds.length > 0) {
      const { data: peers } = await db.from("doctor_specialties").select("doctor_id").in("specialty_id", specialtyIds);
      peerIds = ([...new Set((peers ?? []).map((r: any) => r.doctor_id))] as string[]).filter(id => id !== a.doctor_id);
    }

    // Filtra por especialidade só quando existem colegas; caso contrário lista todos os médicos aprovados.
    let filteredBySpecialty = specialtyIds.length > 0 && peerIds.length > 0;
    let docQuery = db.from("doctor_profiles").select("id, user_id, is_approved").eq("is_approved", true);
    if (filteredBySpecialty) docQuery = docQuery.in("id", peerIds);
    const { data: docs } = await docQuery;

    const list = (docs ?? []).filter((d: any) => d.id !== a.doctor_id);
    const userIds = list.map((d: any) => d.user_id);
    const { data: profs } = userIds.length > 0
      ? await db.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds)
      : { data: [] as any[] };
    const nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`]));

    setCandidates(
      list
        .map((d: any) => ({ id: d.id, name: nameMap.get(d.user_id) ?? "Médico" }))
        .sort((x: DoctorOption, y: DoctorOption) => x.name.localeCompare(y.name)),
    );
    setCandidatesFiltered(filteredBySpecialty);
    setReassignLoading(false);
  };

  const confirmReassign = async () => {
    if (!reassignAppt || !selectedDoctorId) return;
    setActing(true);
    const previousDoctorId = reassignAppt.doctor_id;
    const { error } = await db.from("appointments")
      .update({ doctor_id: selectedDoctorId, updated_at: new Date().toISOString() })
      .eq("id", reassignAppt.id);
    if (error) {
      toast.error("Erro ao reatribuir", { description: error.message });
      setActing(false);
      return;
    }
    await logAdminAction("appointment.reassign", reassignAppt.id, {
      previous_doctor_id: previousDoctorId,
      new_doctor_id: selectedDoctorId,
    });
    toast.success("Consulta reatribuída ✅");
    setReassignAppt(null);
    setSelectedDoctorId("");
    setActing(false);
    fetchAppointments();
  };

  // Export: busca TODAS as linhas do filtro atual (sem paginação) para um CSV completo.
  const handleExport = async () => {
    let query = db.from("appointments").select(APPT_SELECT).order("scheduled_at", { ascending: false });
    query = await applyFilters(query);
    const { data } = await query;
    if (!data || data.length === 0) { toast.error("Nenhuma consulta para exportar"); return; }
    const enriched = await resolveNames(data);
    const rows = enriched.filter(a =>
      `${a.patient_name} ${a.doctor_name}`.toLowerCase().includes(debouncedSearch.toLowerCase()),
    );
    if (rows.length === 0) { toast.error("Nenhuma consulta para exportar"); return; }
    exportToCSV(
      `consultas_${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map(a => ({
        paciente: a.patient_name ?? "",
        medico: a.doctor_name ? `Dr(a). ${a.doctor_name}` : "",
        data_hora: format(new Date(a.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        tipo: (a.appointment_type && (typeLabel[a.appointment_type] ?? a.appointment_type)) || "",
        duracao_min: a.duration_minutes ?? 30,
        status: statusLabel[a.status] ?? a.status,
        pagamento: a.payment_status ?? "",
        preco: a.price_at_booking ?? "",
      })),
      [
        { key: "paciente", label: "Paciente" },
        { key: "medico", label: "Médico" },
        { key: "data_hora", label: "Data/Hora" },
        { key: "tipo", label: "Tipo" },
        { key: "duracao_min", label: "Duração (min)" },
        { key: "status", label: "Status" },
        { key: "pagamento", label: "Pagamento" },
        { key: "preco", label: "Preço" },
      ],
    );
    toast.success(`${rows.length} consulta${rows.length === 1 ? "" : "s"} exportada${rows.length === 1 ? "" : "s"}`);
  };

  // Busca é aplicada apenas sobre a página atual (client-side); status, período e especialidade são server-side.
  const filtered = appointments.filter(a => {
    const matchSearch = `${a.patient_name} ${a.doctor_name}`.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <DashboardLayout title="Administração" nav={getAdminNav("appointments")}>
      <div className="w-full mx-auto max-w-5xl space-y-5 pb-24 md:pb-6">
        <AdminPageHeader
          icon={Video}
          eyebrow="Operação"
          title="Consultas"
          description="Acompanhe consultas agendadas, em andamento e finalizadas."
          accent="from-blue-500 to-indigo-600"
          badge={{ label: `${filtered.length} ${filtered.length === 1 ? "consulta" : "consultas"}`, tone: "info" }}
          actions={
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          }
        />

        {/* Live indicators */}
        <div className="flex gap-3">
          <Card className="border-border flex-1">
            <CardContent className="p-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <Video className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{liveCount} ao vivo</span>
            </CardContent>
          </Card>
          <Card className="border-border flex-1">
            <CardContent className="p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-secondary" />
              <span className="text-sm font-medium text-foreground">{waitingCount} aguardando</span>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3 mb-4">
          {/* Busca filtra apenas a página atual */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar paciente ou médico (página atual)..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); pg.setPage(0); }} className="w-[9.5rem]" aria-label="Data inicial" />
              <span className="text-sm text-muted-foreground">até</span>
              <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); pg.setPage(0); }} className="w-[9.5rem]" aria-label="Data final" />
            </div>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); pg.setPage(0); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="scheduled">Agendada</SelectItem>
                <SelectItem value="confirmed">Confirmada</SelectItem>
                <SelectItem value="waiting">Esperando</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
                <SelectItem value="no_show">Ausente</SelectItem>
                <SelectItem value="payment_pending">Aguardando pgto.</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSpecialty} onValueChange={v => { setFilterSpecialty(v); pg.setPage(0); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Especialidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas especialidades</SelectItem>
                {specialties.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? <div className="shimmer-v2 h-5 rounded w-32 inline-block" aria-label="Carregando" /> : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto -mx-0.5 rounded-xl">

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="hidden sm:table-cell">Médico</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead className="hidden lg:table-cell">Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => {
                  const canCancel = !["cancelled", "completed"].includes(a.status);
                  const canComplete = !["cancelled", "completed"].includes(a.status);
                  const canNoShow = !["cancelled", "completed", "no_show"].includes(a.status);
                  // Só oferece estorno quando há pagamento aprovado e ainda não reembolsado.
                  const canRefund = ["approved", "paid"].includes(String(a.payment_status));
                  return (
                  <TableRow key={a.id} className={a.status === "in_progress" ? "bg-primary/5" : a.status === "waiting" ? "bg-secondary/5" : ""}>
                    <TableCell data-label="Paciente" className="font-medium text-foreground">{a.patient_name}</TableCell>
                    <TableCell data-label="Médico" className="hidden sm:table-cell text-muted-foreground">Dr(a). {a.doctor_name}</TableCell>
                    <TableCell data-label="Data" className="text-muted-foreground">{format(new Date(a.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell data-label="Tipo" className="hidden md:table-cell">
                      {a.appointment_type && (
                        <Badge variant="outline" className="text-xs">
                          {typeLabel[a.appointment_type] ?? a.appointment_type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell data-label="Duração" className="hidden lg:table-cell text-muted-foreground">{a.duration_minutes || 30} min</TableCell>
                    <TableCell data-label="Status">
                      <Badge variant={statusVariant[a.status] ?? "outline"}>
                        {a.status === "in_progress" && <span className="w-1.5 h-1.5 rounded-full bg-white mr-1 shimmer-v2 inline-block" />}
                        {statusLabel[a.status] ?? a.status}
                      </Badge>
                    </TableCell>
                    <TableCell data-label="Ações" className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações da consulta">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="text-[11px]">Ações administrativas</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openReassign(a)}>
                            <UserCog className="w-4 h-4 mr-2" /> Reatribuir médico
                          </DropdownMenuItem>
                          {canComplete && (
                            <DropdownMenuItem onClick={() => forceComplete(a)}>
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Forçar conclusão
                            </DropdownMenuItem>
                          )}
                          {canNoShow && (
                            <DropdownMenuItem onClick={() => markNoShow(a)}>
                              <UserX className="w-4 h-4 mr-2" /> Marcar falta
                            </DropdownMenuItem>
                          )}
                          {canCancel && (
                            <DropdownMenuItem onClick={() => cancelAppt(a)} className="text-destructive focus:text-destructive">
                              <XCircle className="w-4 h-4 mr-2" /> Cancelar consulta
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={!canRefund || acting}
                            onClick={() => refundAppt(a)}
                            className="text-destructive focus:text-destructive"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" /> {canRefund ? "Estornar pagamento" : "Estornar (sem pgto.)"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma consulta.</TableCell></TableRow>}
              </TableBody>
            </Table>
            </div>
            <PaginationBar pg={pg} noun="consultas" className="px-3 py-2 border-t border-border/40" />
          </div>
        )}
      </div>

      {/* Reatribuição de médico */}
      <Dialog open={!!reassignAppt} onOpenChange={v => { if (!v) { setReassignAppt(null); setSelectedDoctorId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reatribuir médico</DialogTitle>
            <DialogDescription>
              {candidatesFiltered
                ? "Médicos aprovados com a mesma especialidade do médico atual."
                : "Nenhum médico da mesma especialidade — exibindo todos os médicos aprovados."}
            </DialogDescription>
          </DialogHeader>
          {reassignLoading ? (
            <div className="shimmer-v2 h-9 rounded" aria-label="Carregando médicos" />
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum médico disponível para reatribuição.</p>
          ) : (
            <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
              <SelectTrigger><SelectValue placeholder="Selecione um médico" /></SelectTrigger>
              <SelectContent>
                {candidates.map(c => <SelectItem key={c.id} value={c.id}>Dr(a). {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReassignAppt(null); setSelectedDoctorId(""); }}>Cancelar</Button>
            <Button onClick={confirmReassign} disabled={!selectedDoctorId || acting}>{acting ? "Salvando..." : "Reatribuir"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminAppointments;
