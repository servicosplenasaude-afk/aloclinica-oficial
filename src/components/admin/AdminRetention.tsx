import { useState, useEffect } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getAdminNav } from "@/components/admin/adminNav";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatBento, BentoItem } from "@/components/dashboards/StatBento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Repeat, Calendar, Info, Users, Sprout } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  startOfMonth, differenceInCalendarMonths, differenceInDays, addMonths, isAfter, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Configuração da grade de coorte ──
// Colunas relativas: Mês 0, Mês 1, ... Mês 5+ (6 colunas)
const MAX_REL = 5;
const RELATIVE_COLS = MAX_REL + 1;

interface CohortCell {
  pct: number;   // % da coorte ativa neste mês relativo
  count: number; // nº de pacientes ativos
  size: number;  // tamanho da coorte (para tooltip)
}
interface CohortRow {
  key: string;
  label: string;                 // "jul/25"
  size: number;                  // n da coorte
  cells: (CohortCell | null)[];  // null = mês relativo ainda não decorrido (não observável)
}
interface RetentionKPIs {
  totalPatients: number;
  activePatients: number;
  recurring: number;
  recurrenceRate: number;
  avgPerPatient: number;
  return30Rate: number;
}

const EMPTY_KPIS: RetentionKPIs = {
  totalPatients: 0, activePatients: 0, recurring: 0, recurrenceRate: 0, avgPerPatient: 0, return30Rate: 0,
};

const colLabel = (b: number) => (b === MAX_REL ? `Mês ${MAX_REL}+` : `Mês ${b}`);

// Tooltip do gráfico usando tokens do sistema (dark-mode aware)
const chartTooltip = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
};

const AdminRetention = () => {
  const [loading, setLoading] = useState(true);
  const [windowMonths, setWindowMonths] = useState("6"); // quantas coortes exibir
  const [kpis, setKpis] = useState<RetentionKPIs>(EMPTY_KPIS);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [curve, setCurve] = useState<{ label: string; retencao: number | null }[]>([]);
  const [hasData, setHasData] = useState(false);

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [windowMonths]);

  const fetchData = async () => {
    setLoading(true);
    const now = new Date();
    const currentMonth = startOfMonth(now);

    // ── 1. Quem são os pacientes (mesma fonte usada em AdminPatients) ──
    const { data: roleRows } = await db.from("user_roles").select("user_id").eq("role", "patient");
    const patientIds = new Set<string>((roleRows ?? []).map((r: any) => r.user_id).filter(Boolean));

    // ── 2. Data de cadastro (coorte) — appointments.patient_id === profiles.user_id ──
    const { data: profs } = await db.from("profiles").select("user_id, created_at");
    const signup = new Map<string, Date>();
    (profs ?? []).forEach((p: any) => {
      if (p.user_id && p.created_at && patientIds.has(p.user_id)) {
        signup.set(p.user_id, new Date(p.created_at));
      }
    });

    // ── 3. Consultas concluídas (mesmo filtro de status das demais telas admin) ──
    const { data: appts } = await db.from("appointments").select("patient_id, scheduled_at, status");
    const byPatient = new Map<string, Date[]>();
    (appts ?? []).forEach((a: any) => {
      if (a.status !== "completed" || !a.patient_id || !a.scheduled_at) return;
      if (!signup.has(a.patient_id)) return;
      const arr = byPatient.get(a.patient_id) ?? [];
      arr.push(new Date(a.scheduled_at));
      byPatient.set(a.patient_id, arr);
    });

    // ── KPIs ──
    const totalPatients = signup.size;
    const activePatients = byPatient.size;                       // ≥1 consulta concluída
    const totalCompleted = [...byPatient.values()].reduce((acc, d) => acc + d.length, 0);
    const recurring = [...byPatient.values()].filter((d) => d.length >= 2).length; // ≥2 consultas
    const recurrenceRate = activePatients > 0 ? (recurring / activePatients) * 100 : 0;
    const avgPerPatient = activePatients > 0 ? totalCompleted / activePatients : 0;

    // % que retorna em ≤30 dias após a 1ª consulta (entre os que consultaram)
    let within30 = 0;
    byPatient.forEach((dates) => {
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
      const first = sorted[0];
      const returned = sorted.slice(1).some((d) => {
        const gap = differenceInDays(d, first);
        return gap >= 0 && gap <= 30;
      });
      if (returned) within30++;
    });
    const return30Rate = activePatients > 0 ? (within30 / activePatients) * 100 : 0;

    setKpis({ totalPatients, activePatients, recurring, recurrenceRate, avgPerPatient, return30Rate });
    setHasData(activePatients > 0);

    // ── Agrupa pacientes por mês de cadastro (coorte) ──
    const cohortMap = new Map<string, { month: Date; ids: string[] }>();
    signup.forEach((date, uid) => {
      const cm = startOfMonth(date);
      const key = format(cm, "yyyy-MM");
      const entry = cohortMap.get(key) ?? { month: cm, ids: [] };
      entry.ids.push(uid);
      cohortMap.set(key, entry);
    });

    // Ordena cronologicamente (mais antigo no topo) e recorta a janela pedida
    const ordered = [...cohortMap.values()].sort((a, b) => a.month.getTime() - b.month.getTime());
    const shown = ordered.slice(-parseInt(windowMonths, 10));

    const rows: CohortRow[] = shown.map((c) => {
      const size = c.ids.length;
      const activeCounts = new Array(RELATIVE_COLS).fill(0);
      c.ids.forEach((uid) => {
        const dates = byPatient.get(uid);
        if (!dates) return;
        const sMonth = startOfMonth(signup.get(uid)!);
        const buckets = new Set<number>();
        dates.forEach((d) => {
          let r = differenceInCalendarMonths(startOfMonth(d), sMonth);
          if (r < 0) return;              // ignora consulta anterior ao cadastro (defensivo)
          if (r > MAX_REL) r = MAX_REL;   // agrupa tudo ≥5 no bucket "5+"
          buckets.add(r);
        });
        buckets.forEach((b) => { activeCounts[b] += 1; });
      });

      const cells = activeCounts.map((count, b) => {
        // Só é observável se o mês-calendário relativo já chegou
        const observable = !isAfter(addMonths(c.month, b), currentMonth);
        if (!observable) return null;
        return { pct: size > 0 ? (count / size) * 100 : 0, count, size } as CohortCell;
      });

      return {
        key: format(c.month, "yyyy-MM"),
        label: format(c.month, "MMM/yy", { locale: ptBR }),
        size,
        cells,
      };
    });
    setCohorts(rows);

    // ── Curva de retenção: média das coortes por mês relativo ──
    const curveData = Array.from({ length: RELATIVE_COLS }, (_, b) => {
      const vals = rows
        .map((r) => r.cells[b])
        .filter((c): c is CohortCell => c !== null)
        .map((c) => c.pct);
      return {
        label: colLabel(b),
        retencao: vals.length > 0 ? +(vals.reduce((a, v) => a + v, 0) / vals.length).toFixed(1) : null,
      };
    });
    setCurve(curveData);

    setLoading(false);
  };

  // ── KPI cards (estilo StatBento do sistema) ──
  const statItems: BentoItem[] = [
    {
      label: "Pacientes cadastrados", value: kpis.totalPatients, icon: "👥",
      iconBg: "bg-blue-50 dark:bg-blue-950/30", valueClass: "text-[#1255C8] dark:text-blue-400", accentClass: "bg-blue-500",
      sub: `${kpis.activePatients} já consultaram`,
    },
    {
      label: "Pacientes recorrentes", value: kpis.recurring, icon: "🔁",
      iconBg: "bg-violet-50 dark:bg-violet-950/30", valueClass: "text-violet-700 dark:text-violet-400", accentClass: "bg-violet-500",
      sub: "≥ 2 consultas concluídas",
    },
    {
      label: "Taxa de recorrência", value: `${kpis.recurrenceRate.toFixed(0)}%`, icon: "📈",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/30", valueClass: "text-emerald-700 dark:text-emerald-400", accentClass: "bg-emerald-500",
      sub: "dos que já consultaram",
    },
    {
      label: "Consultas por paciente", value: kpis.avgPerPatient > 0 ? kpis.avgPerPatient.toFixed(1) : "—", icon: "🩺",
      iconBg: "bg-cyan-50 dark:bg-cyan-950/30", valueClass: "text-cyan-700 dark:text-cyan-400", accentClass: "bg-cyan-500",
      sub: "média entre ativos",
    },
    {
      label: "Retorno em ≤30 dias", value: `${kpis.return30Rate.toFixed(0)}%`, icon: "⏱️",
      iconBg: "bg-amber-50 dark:bg-amber-950/30", valueClass: "text-amber-600 dark:text-amber-400", accentClass: "bg-amber-500",
      sub: "após a 1ª consulta",
    },
  ];

  return (
    <DashboardLayout title="Administração" nav={getAdminNav("retention")}>
      <div className="w-full mx-auto max-w-6xl space-y-5 pb-24 md:pb-6">
        <AdminPageHeader
          icon={Repeat}
          eyebrow="Visão Geral"
          title="Retenção & Coortes"
          description="Quantos pacientes voltam a consultar e como cada safra de cadastro se mantém ao longo do tempo."
          accent="from-violet-500 to-fuchsia-600"
          actions={
            <Select value={windowMonths} onValueChange={setWindowMonths}>
              <SelectTrigger className="w-[150px] h-9">
                <Calendar className="w-4 h-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 coortes</SelectItem>
                <SelectItem value="12">12 coortes</SelectItem>
              </SelectContent>
            </Select>
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
        ) : !hasData ? (
          // ── Empty state acolhedor ──
          <Card className="border-border border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center gap-4 py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 flex items-center justify-center">
                <Sprout className="w-8 h-8 text-violet-500" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h2 className="text-lg font-bold text-foreground">Seus dados de retenção estão a caminho</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Assim que os pacientes começarem a realizar consultas na plataforma, esta tela mostrará
                  automaticamente quantos deles voltam a consultar e como cada safra de cadastro se comporta mês a mês.
                </p>
                <p className="text-xs text-muted-foreground/70 pt-1">
                  {kpis.totalPatients > 0
                    ? `Já temos ${kpis.totalPatients} paciente(s) cadastrado(s) — falta registrar consultas concluídas.`
                    : "Ainda não há pacientes cadastrados."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── KPIs ── */}
            <StatBento stats={statItems} />

            {/* ── Tabela de coorte (heatmap) ── */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> Retenção por Coorte de Cadastro
                </CardTitle>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-1">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Cada linha é o mês de cadastro (n = pacientes). As colunas mostram o % da coorte que teve ao
                  menos uma consulta concluída naquele mês relativo. Células vazias indicam períodos que ainda
                  não decorreram.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-separate border-spacing-1">
                    <thead>
                      <tr>
                        <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1 w-[112px]">
                          Coorte (n)
                        </th>
                        {Array.from({ length: RELATIVE_COLS }, (_, b) => (
                          <th key={b} className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1">
                            {colLabel(b)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cohorts.map((row) => (
                        <tr key={row.key}>
                          <td className="px-2 py-1 align-middle">
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm font-semibold text-foreground capitalize">{row.label}</span>
                              <span className="text-[10px] text-muted-foreground">n = {row.size}</span>
                            </div>
                          </td>
                          {row.cells.map((cell, b) => {
                            if (!cell) {
                              return (
                                <td key={b} className="p-0.5">
                                  <div className="h-11 rounded-md bg-muted/20 flex items-center justify-center text-muted-foreground/30 text-xs">
                                    –
                                  </div>
                                </td>
                              );
                            }
                            const intensity = Math.max(0, Math.min(1, cell.pct / 100));
                            const bg = cell.pct === 0
                              ? "hsl(var(--primary) / 0.05)"
                              : `hsl(var(--primary) / ${(0.12 + intensity * 0.83).toFixed(3)})`;
                            const textCls = intensity >= 0.55 ? "text-white" : "text-foreground";
                            return (
                              <td key={b} className="p-0.5">
                                <div
                                  className={`h-11 rounded-md flex items-center justify-center transition-colors cursor-default ${textCls}`}
                                  style={{ backgroundColor: bg }}
                                  title={`${row.label} · ${colLabel(b)}: ${cell.count} de ${cell.size} paciente(s) (${Math.round(cell.pct)}%)`}
                                >
                                  <span className="text-xs font-bold tabular-nums">{Math.round(cell.pct)}%</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Legenda de intensidade */}
                  <div className="flex items-center justify-end gap-2 mt-3 min-w-[560px]">
                    <span className="text-[10px] text-muted-foreground">Menor retenção</span>
                    {[0.12, 0.34, 0.56, 0.78, 0.95].map((op, i) => (
                      <div key={i} className="w-5 h-4 rounded-sm" style={{ backgroundColor: `hsl(var(--primary) / ${op})` }} />
                    ))}
                    <span className="text-[10px] text-muted-foreground">Maior retenção</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Curva de retenção (média das coortes) ── */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-primary" /> Curva de Retenção Média
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  % médio de pacientes que continuam consultando, por mês desde o cadastro.
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={curve} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis domain={[0, 100]} fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={chartTooltip}
                        formatter={(v: number) => [`${v}%`, "Retenção média"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="retencao"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#retentionGrad)"
                        connectNulls
                        dot={{ r: 3, fill: "hsl(var(--primary))" }}
                        name="Retenção média"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminRetention;
