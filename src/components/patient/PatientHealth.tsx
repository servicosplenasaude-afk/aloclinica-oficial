import { useState, useEffect } from "react";
import mascotWave from "@/assets/states/pingo-saude-paciente.webp";
import mascotThumbsup from "@/assets/states/pingo-progresso-saude.webp";
import mascotReading from "@/assets/states/pingo-prontuario-paciente.webp";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import { formatSoapNotes } from "@/lib/soap";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getPatientNav } from "./patientNav";
import HealthScoreRing from "./HealthScoreRing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download, FileText, Heart, Clock, Search, Activity, Plus, Thermometer,
  Droplets, Weight, HeartPulse, TrendingUp, TrendingDown, Minus, Calendar,
  Stethoscope, Pill, FileCheck, BarChart3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";

const METRIC_TYPES = [
  { value: "blood_pressure_sys", label: "Pressão Sistólica", unit: "mmHg", icon: HeartPulse, bg: "bg-destructive/10", text: "text-destructive", normalRange: [90, 120] },
  { value: "blood_pressure_dia", label: "Pressão Diastólica", unit: "mmHg", icon: HeartPulse, bg: "bg-[hsl(var(--p-primary))]/10", text: "text-[hsl(var(--p-primary))]", normalRange: [60, 80] },
  { value: "weight", label: "Peso", unit: "kg", icon: Weight, bg: "bg-warning/10", text: "text-warning", normalRange: [50, 100] },
  { value: "glucose", label: "Glicose", unit: "mg/dL", icon: Droplets, bg: "bg-secondary/10", text: "text-secondary", normalRange: [70, 100] },
  { value: "temperature", label: "Temperatura", unit: "°C", icon: Thermometer, bg: "bg-[hsl(var(--p-primary))]/10", text: "text-[hsl(var(--p-primary))]", normalRange: [36.0, 37.5] },
  { value: "heart_rate", label: "Freq. Cardíaca", unit: "bpm", icon: Activity, bg: "bg-destructive/10", text: "text-destructive", normalRange: [60, 100] },
];

const getStatusColor = (value: number, range: number[]) => {
  if (value < range[0]) return "text-[hsl(var(--p-primary))]";
  if (value > range[1]) return "text-destructive";
  return "text-success";
};

const getTrend = (data: any[], type: string) => {
  const filtered = data.filter(m => m.type === type);
  if (filtered.length < 2) return null;
  const last = filtered[filtered.length - 1].value;
  const prev = filtered[filtered.length - 2].value;
  const diff = last - prev;
  return { diff, direction: diff > 0 ? "up" : diff < 0 ? "down" : "stable" };
};

const PatientHealth = () => {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMetricType, setSelectedMetricType] = useState("blood_pressure_sys");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newMetric, setNewMetric] = useState({ type: "blood_pressure_sys", value: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) fetchAll(); }, [user]);

  const fetchAll = async () => {
    const [apptRes, prescRes, docsRes, metricsRes] = await Promise.all([
      db.from("appointments")
        .select("id, scheduled_at, status, doctor_id, notes, duration_minutes")
        .eq("patient_id", user!.id).eq("status", "completed")
        .order("scheduled_at", { ascending: false }),
      db.from("prescriptions")
        .select("id, appointment_id, diagnosis, medications, observations, created_at, doctor_id, pdf_url")
        .eq("patient_id", user!.id).order("created_at", { ascending: false }),
      db.from("patient_documents")
        .select("*").eq("patient_id", user!.id).order("created_at", { ascending: false }),
      db.from("health_metrics")
        .select("*").eq("patient_id", user!.id).order("measured_at", { ascending: true }),
    ]);

    const allDoctorIds = [...new Set([
      ...(apptRes.data ?? []).map(a => a.doctor_id),
      ...(prescRes.data ?? []).map(p => p.doctor_id),
    ])];

    const docNameMap = new Map<string, string>();
    if (allDoctorIds.length > 0) {
      const { data: docs } = await db.from("doctor_profiles").select("id, user_id").in("id", allDoctorIds);
      if (docs && docs.length > 0) {
        const userIds = docs.map(d => d.user_id);
        const { data: profiles } = await db.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
        docs.forEach(d => {
          const p = profiles?.find(pr => pr.user_id === d.user_id);
          if (p) docNameMap.set(d.id, `Dr(a). ${p.first_name} ${p.last_name}`);
        });
      }
    }

    const apptIds = (apptRes.data ?? []).map(a => a.id);
    const { data: notes } = apptIds.length > 0
      ? await (db as any).from("appointment_notes").select("appointment_id, content").eq("type", "soap").in("appointment_id", apptIds)
      : { data: [] };
    const notesMap = new Map<string, string>();
    (notes ?? []).forEach((n: any) => { const t = formatSoapNotes(n.content); if (t) notesMap.set(n.appointment_id, t); });

    setConsultations((apptRes.data ?? []).map(a => ({
      ...a, doctor_name: docNameMap.get(a.doctor_id) ?? "Médico",
      consultation_notes: notesMap.get(a.id) ?? null,
    })));
    setPrescriptions((prescRes.data ?? []).map(p => ({ ...p, doctor_name: docNameMap.get(p.doctor_id) ?? "Médico" })));
    setDocuments(docsRes.data ?? []);
    setMetrics(metricsRes.data ?? []);
    setLoading(false);
  };

  const saveMetric = async () => {
    if (!newMetric.value || !user) return;
    setSaving(true);
    const metricInfo = METRIC_TYPES.find(m => m.value === newMetric.type);
    const { error } = await db.from("health_metrics").insert({
      patient_id: user.id,
      type: newMetric.type,
      value: parseFloat(newMetric.value),
      unit: metricInfo?.unit ?? "",
      notes: newMetric.notes || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar métrica");
    } else {
      toast.success("Métrica registrada!");
      setAddDialogOpen(false);
      setNewMetric({ type: "blood_pressure_sys", value: "", notes: "" });
      fetchAll();
    }
  };

  const downloadPrescription = (prescription: any) => {
    if (prescription.pdf_url) {
      window.open(prescription.pdf_url, "_blank");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Receita Médica Digital", 20, 20);
    doc.setFontSize(12);
    doc.text(`Médico: ${prescription.doctor_name}`, 20, 35);
    doc.text(`Data: ${format(new Date(prescription.created_at), "dd/MM/yyyy", { locale: ptBR })}`, 20, 42);
    if (prescription.diagnosis) doc.text(`Diagnóstico: ${prescription.diagnosis}`, 20, 55);
    doc.text("Medicamentos:", 20, 68);
    const meds = Array.isArray(prescription.medications) ? prescription.medications : [];
    meds.forEach((med: any, i: number) => {
      const text = typeof med === "string" ? med : `${med.name || med.medication || "—"} - ${med.dosage || ""} - ${med.instructions || ""}`;
      doc.text(`${i + 1}. ${text}`, 25, 78 + i * 8);
    });
    if (prescription.observations) doc.text(`Observações: ${prescription.observations}`, 20, 90 + meds.length * 8);
    doc.save(`receita-${prescription.id.slice(0, 8)}.pdf`);
  };

  const viewDocument = async (doc: any) => {
    const { data } = await db.storage.from("patient-documents").createSignedUrl(doc.file_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const filteredConsultations = consultations.filter(c =>
    c.doctor_name.toLowerCase().includes(search.toLowerCase())
  );

  const currentMetricConfig = METRIC_TYPES.find(m => m.value === selectedMetricType);
  const filteredMetrics = metrics.filter(m => m.type === selectedMetricType);
  const chartData = filteredMetrics.map(m => ({
    date: format(new Date(m.measured_at), "dd/MM", { locale: ptBR }),
    value: m.value,
  }));

  const lastMetricByType = METRIC_TYPES.map(mt => {
    const latest = metrics.filter(m => m.type === mt.value).slice(-1)[0];
    const trend = getTrend(metrics, mt.value);
    return { ...mt, latest, trend };
  });

  const statCards = [
    { label: "Consultas", value: consultations.length, icon: Stethoscope, gradient: "from-[hsl(var(--p-primary))]/15 to-[hsl(var(--p-primary))]/5", iconColor: "text-[hsl(var(--p-primary))]" },
    { label: "Receitas", value: prescriptions.length, icon: Pill, gradient: "from-secondary/15 to-secondary/5", iconColor: "text-secondary" },
    { label: "Exames", value: documents.length, icon: FileCheck, gradient: "from-[hsl(var(--p-primary))]/10 to-secondary/5", iconColor: "text-[hsl(var(--p-primary))]" },
    { label: "Métricas", value: metrics.length, icon: BarChart3, gradient: "from-warning/15 to-warning/5", iconColor: "text-warning" },
  ];

  return (
    <DashboardLayout title="Paciente" nav={getPatientNav("health")} role="patient">
      <div className="w-full mx-auto max-w-5xl pb-24 md:pb-6">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-[linear-gradient(135deg,#eef7ff_0%,#ffffff_52%,#f4fff7_100%)] p-5 shadow-[0_24px_70px_-46px_rgba(15,42,90,.68)] md:p-6">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/16 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-16 h-40 w-40 rounded-full bg-emerald-300/14 blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-12 h-12 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center">
                  <Heart className="w-6 h-6 text-[hsl(var(--p-primary))]" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-foreground font-[Manrope]">Minha Saúde</h1>
                  <p className="text-xs text-muted-foreground">Seu painel de monitoramento completo</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Score de saúde */}
        {user?.id && <div className="mb-5"><HealthScoreRing patientUserId={user.id} /></div>}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
          {loading ? (
            [0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)
          ) : (
            statCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Card className={`border border-white/60 shadow-sm bg-gradient-to-br ${stat.gradient} overflow-hidden rounded-[24px] transition-shadow hover:shadow-[var(--p-shadow-card)]`}>
                    <CardContent className="p-3 text-center">
                      <Icon className={`w-5 h-5 ${stat.iconColor} mx-auto mb-1.5`} />
                      <p className="text-2xl font-extrabold text-foreground leading-none font-[Manrope] tabular-nums">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-tight uppercase tracking-wider font-semibold">{stat.label}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Vital Signs Dashboard */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[hsl(var(--p-primary))]" />
              <h2 className="text-sm font-bold text-foreground font-[Manrope]">Sinais Vitais</h2>
            </div>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 text-xs gap-1 rounded-full bg-[hsl(var(--p-primary))] text-white shadow-[var(--p-shadow-btn)]">
                  <Plus className="w-3.5 h-3.5" /> Registrar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registrar Métrica</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={newMetric.type} onValueChange={v => setNewMetric(p => ({ ...p, type: v }))}>
                      <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {METRIC_TYPES.map(mt => (
                          <SelectItem key={mt.value} value={mt.value}>{mt.label} ({mt.unit})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newMetric.value}
                      onChange={e => setNewMetric(p => ({ ...p, value: e.target.value }))}
                      placeholder={METRIC_TYPES.find(m => m.value === newMetric.type)?.unit}
                      className="mt-1 rounded-2xl h-11"
                    />
                  </div>
                  <div>
                    <Label>Observações (opcional)</Label>
                    <Input
                      value={newMetric.notes}
                      onChange={e => setNewMetric(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Ex: após exercício..."
                      className="mt-1 rounded-2xl h-11"
                    />
                  </div>
                  <Button onClick={saveMetric} disabled={saving || !newMetric.value} className="w-full rounded-full bg-[hsl(var(--p-primary))] text-white">
                    {saving ? "Salvando..." : "Salvar Métrica"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {lastMetricByType.map((mt, i) => {
              const IconComp = mt.icon;
              const isSelected = selectedMetricType === mt.value;
              const isNormal = mt.latest ? (mt.latest.value >= mt.normalRange[0] && mt.latest.value <= mt.normalRange[1]) : true;
              return (
                <motion.button
                  key={mt.value}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedMetricType(mt.value)}
                  className={`relative p-3 rounded-[24px] border text-left transition-all overflow-hidden ${
                    isSelected
                      ? "border-[hsl(var(--p-primary))]/40 bg-[hsl(var(--p-primary))]/5 shadow-[var(--p-shadow-card)] ring-1 ring-[hsl(var(--p-primary))]/20"
                      : "border-border/40 bg-card/95 hover:border-[hsl(var(--p-primary))]/20 hover:shadow-[var(--p-shadow-card)]"
                  }`}
                >
                  <div className={`absolute top-0 left-0 right-0 h-[3px] bg-[hsl(var(--p-primary))] rounded-t-2xl ${isSelected ? "opacity-100" : "opacity-0"} transition-opacity`} />

                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-10 h-10 rounded-2xl ${mt.bg} flex items-center justify-center`}>
                      <IconComp className={`w-5 h-5 ${mt.text}`} />
                    </div>
                    {mt.trend && (
                      <div className={`flex items-center gap-0.5 text-[10px] font-medium ${
                        mt.trend.direction === "up" ? "text-destructive" : mt.trend.direction === "down" ? "text-[hsl(var(--p-primary))]" : "text-muted-foreground"
                      }`}>
                        {mt.trend.direction === "up" ? <TrendingUp className="w-3 h-3" /> :
                         mt.trend.direction === "down" ? <TrendingDown className="w-3 h-3" /> :
                         <Minus className="w-3 h-3" />}
                        {Math.abs(mt.trend.diff).toFixed(1)}
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1">{mt.label}</p>
                  <p className="font-[Manrope] text-[28px] font-extrabold text-foreground leading-none tabular-nums">
                    {mt.latest ? mt.latest.value : "—"}
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">{mt.unit}</span>
                  </p>

                  {mt.latest && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Badge className={`text-[9px] px-2 py-0 h-4 ${isNormal ? "bg-[hsl(var(--p-success-soft))] text-success border-success/20" : "bg-[hsl(var(--p-danger-soft))] text-destructive border-destructive/20"}`} variant="outline">
                        {isNormal ? "Normal" : "Atenção"}
                      </Badge>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Chart */}
          {chartData.length > 1 ? (
            <Card className="border-border/40 shadow-[var(--p-shadow-card)] mb-6 overflow-hidden rounded-2xl">
              <CardHeader className="pb-1 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-bold text-foreground flex items-center gap-2 font-[Manrope]">
                    <div className="w-2 h-2 rounded-full bg-[hsl(var(--p-primary))]" />
                    {currentMetricConfig?.label}
                  </CardTitle>
                  <Badge variant="secondary" className="text-[9px] h-5">
                    {filteredMetrics.length} registros
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="h-[200px] px-2 pb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--p-primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--p-primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "12px",
                        boxShadow: "var(--p-shadow-elevated)",
                      }}
                      formatter={(v: number) => [`${v} ${currentMetricConfig?.unit}`, currentMetricConfig?.label]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--p-primary))"
                      strokeWidth={2.5}
                      fill="url(#metricGradient)"
                      dot={{ r: 3, fill: "hsl(var(--p-primary))", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "hsl(var(--p-primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-border/40 mb-6 rounded-[28px] bg-card/80 shadow-sm">
              <CardContent className="py-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Activity className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground font-[Manrope]">Gráfico de evolução</p>
                <p className="text-xs text-muted-foreground mt-1">Registre pelo menos 2 medições para visualizar</p>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por médico..." aria-label="Buscar no histórico por médico" value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 rounded-2xl bg-muted/30 border-border/40" />
        </div>

        {/* Tabs for history */}
        <Tabs defaultValue="consultations">
          <TabsList className="grid w-full grid-cols-4 h-11 rounded-[22px] bg-muted/50 p-1">
            <TabsTrigger value="consultations" className="text-[11px] rounded-xl data-[state=active]:shadow-[var(--p-shadow-card)] data-[state=active]:bg-card font-semibold">
              Consultas
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="text-[11px] rounded-xl data-[state=active]:shadow-[var(--p-shadow-card)] data-[state=active]:bg-card font-semibold">
              Receitas
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-[11px] rounded-xl data-[state=active]:shadow-[var(--p-shadow-card)] data-[state=active]:bg-card font-semibold">
              Exames
            </TabsTrigger>
            <TabsTrigger value="history" className="text-[11px] rounded-xl data-[state=active]:shadow-[var(--p-shadow-card)] data-[state=active]:bg-card font-semibold">
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Consultations */}
          <TabsContent value="consultations" className="mt-3 space-y-2">
            {loading ? (
              [0,1,2].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
            ) : filteredConsultations.length === 0 ? (
              <EmptyState img={mascotWave} text="Nenhuma consulta realizada" />
            ) : filteredConsultations.map(a => (
              <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.97 }}>
                <Card className="border-border/30 shadow-[var(--p-shadow-card)] hover:shadow-[var(--p-shadow-elevated)] transition-shadow overflow-hidden rounded-2xl">
                  <CardContent className="p-0">
                    <div className="flex items-stretch">
                      <div className="w-1 bg-gradient-to-b from-[hsl(var(--p-primary))] to-[hsl(var(--p-primary))]/30 shrink-0" />
                      <div className="flex-1 p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-[hsl(var(--p-primary))]/10 flex items-center justify-center shrink-0">
                              <Stethoscope className="w-4 h-4 text-[hsl(var(--p-primary))]" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground leading-tight">{a.doctor_name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                <p className="text-[11px] text-muted-foreground">
                                  {format(new Date(a.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {a.duration_minutes || 30}min
                                </p>
                              </div>
                            </div>
                          </div>
                          <Badge className="bg-[hsl(var(--p-success-soft))] text-success border-success/20 text-[10px] h-5">
                            Concluída
                          </Badge>
                        </div>
                        {a.consultation_notes && (
                          <div className="p-2.5 bg-muted/40 rounded-xl mt-2.5 border border-border/30">
                            <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Anotações do médico</p>
                            <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{a.consultation_notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </TabsContent>

          {/* Prescriptions */}
          <TabsContent value="prescriptions" className="mt-3 space-y-2">
            {prescriptions.length === 0 ? (
              <EmptyState img={mascotThumbsup} text="Nenhuma receita emitida" />
            ) : prescriptions.map(p => (
              <Card key={p.id} className="border-border/30 shadow-[var(--p-shadow-card)] overflow-hidden rounded-2xl">
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    <div className="w-1 bg-gradient-to-b from-secondary to-secondary/30 shrink-0" />
                    <div className="flex-1 p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                            <Pill className="w-4 h-4 text-secondary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground leading-tight">{p.diagnosis || "Receita médica"}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {p.doctor_name} · {format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                            {Array.isArray(p.medications) && p.medications.length > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{p.medications.length} medicamento(s)</p>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 rounded-full" onClick={() => downloadPrescription(p)}>
                          <Download className="w-3.5 h-3.5" /> PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="mt-3 space-y-2">
            {documents.length === 0 ? (
              <EmptyState img={mascotReading} text="Nenhum exame enviado" />
            ) : documents.map(d => (
              <Card key={d.id} className="border-border/30 shadow-[var(--p-shadow-card)] overflow-hidden rounded-2xl">
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    <div className="w-1 bg-gradient-to-b from-[hsl(var(--p-primary))] to-[hsl(var(--p-primary))]/30 shrink-0" />
                    <div className="flex-1 p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[hsl(var(--p-primary))]/10 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-[hsl(var(--p-primary))]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{d.description || d.file_name}</p>
                            <p className="text-[11px] text-muted-foreground">{format(new Date(d.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-8 text-xs rounded-full" onClick={() => viewDocument(d)}>Ver</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Metrics History */}
          <TabsContent value="history" className="mt-3 space-y-2">
            {filteredMetrics.length === 0 ? (
              <Card className="border-dashed border-border/40 rounded-2xl">
                <CardContent className="py-8 text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Sem registros de {currentMetricConfig?.label}</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/30 shadow-[var(--p-shadow-card)] rounded-2xl">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold font-[Manrope]">Histórico — {currentMetricConfig?.label}</CardTitle>
                    <Badge variant="secondary" className="text-[9px] h-5">{filteredMetrics.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                    {[...filteredMetrics].reverse().map(m => {
                      const isNormal = m.value >= (currentMetricConfig?.normalRange[0] ?? 0) && m.value <= (currentMetricConfig?.normalRange[1] ?? 999);
                      return (
                        <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/20">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full ${isNormal ? "bg-success" : "bg-destructive"}`} />
                            <div>
                              <span className="text-sm font-semibold text-foreground tabular-nums">{m.value} <span className="text-[10px] font-normal text-muted-foreground">{m.unit}</span></span>
                              {m.notes && <p className="text-[10px] text-muted-foreground leading-tight">{m.notes}</p>}
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(m.measured_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

const EmptyState = ({ img, text }: { img: string; text: string }) => (
  <div className="relative overflow-hidden rounded-[28px] border border-dashed border-border/45 bg-card px-5 py-10 text-center shadow-sm">
    <div className="pointer-events-none absolute inset-x-10 top-6 h-24 rounded-full bg-primary/10 blur-3xl" />
    <img src={img} alt="Pingo" className="relative w-20 h-20 object-contain mx-auto drop-shadow-md mb-3 select-none" loading="lazy" decoding="async" width={80} height={80} />
    <p className="relative text-sm font-black text-foreground">{text}</p>
    <p className="text-[10px] text-muted-foreground mt-1">Seus dados aparecerão aqui</p>
  </div>
);

export default PatientHealth;
