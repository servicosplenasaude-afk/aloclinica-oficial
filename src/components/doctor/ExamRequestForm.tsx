import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import { logError } from "@/lib/logger";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getDoctorNav } from "./doctorNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Stethoscope, Send, CheckCircle2, Layers, Star, Plus, Save, Trash2, X } from "lucide-react";

const EXAMES_COMUNS = [
  "Hemograma completo", "Glicemia de jejum", "Colesterol total e frações",
  "TSH / T4 livre", "Urina tipo I (EAS)", "Raio-X de tórax", "Eletrocardiograma (ECG)",
  "Ultrassom abdominal", "Beta-HCG", "PCR / VHS",
];

// Painéis: presets que adicionam vários exames de uma vez (dedupe ao aplicar).
const PAINEIS: { nome: string; exames: string[] }[] = [
  { nome: "Check-up básico", exames: ["Hemograma completo", "Glicemia de jejum", "Colesterol total e frações", "TGO / TGP", "Creatinina", "Urina tipo I (EAS)"] },
  { nome: "Tireoide", exames: ["TSH", "T4 livre"] },
  { nome: "Perfil lipídico", exames: ["Colesterol total", "HDL", "LDL", "Triglicerídeos"] },
  { nome: "Pré-natal básico", exames: ["Hemograma completo", "Tipagem sanguínea", "Glicemia de jejum", "Sorologias (pré-natal)"] },
];

// Favoritos pessoais: seleções nomeadas persistidas em localStorage por médico.
// Sem tabela nova no Supabase — mesmo padrão de PrescriptionTemplates.
type ExamFavorite = { id: string; name: string; exames: string[]; created_at: string };
const FAV_KEY = (userId: string) => `exam_favorites_v1:${userId}`;

const parseLinhas = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function loadFavorites(userId: string): ExamFavorite[] {
  try {
    const raw = localStorage.getItem(FAV_KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites(userId: string, list: ExamFavorite[]) {
  try {
    localStorage.setItem(FAV_KEY(userId), JSON.stringify(list));
  } catch { /* quota or private mode */ }
}

const ExamRequestForm = () => {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const appointmentId = params.get("appointment");

  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [doctorProfileId, setDoctorProfileId] = useState<string | null>(null);
  // Quando aberto pelo MENU (sem ?appointment=) não há paciente no contexto.
  // Sem isto, o pedido era gravado com patient_id null (órfão, paciente nunca via).
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([]);
  const [examType, setExamType] = useState("");
  const [clinicalInfo, setClinicalInfo] = useState("");
  const [priority, setPriority] = useState<"normal" | "alta" | "urgente">("normal");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [favorites, setFavorites] = useState<ExamFavorite[]>([]);
  const [savingFav, setSavingFav] = useState(false);
  const [favName, setFavName] = useState("");

  useEffect(() => {
    if (user) {
      db.from("doctor_profiles").select("id").eq("user_id", user.id).maybeSingle()
        .then(({ data }: any) => { if (data) setDoctorProfileId(data.id); });
    }
  }, [user]);

  useEffect(() => {
    if (user) setFavorites(loadFavorites(user.id));
  }, [user]);

  useEffect(() => {
    if (!appointmentId) return;
    db.from("appointments").select("patient_id").eq("id", appointmentId).maybeSingle()
      .then(async ({ data }: any) => {
        if (data?.patient_id) {
          setPatientId(data.patient_id);
          const { data: p } = await db.from("profiles").select("first_name, last_name").eq("user_id", data.patient_id).maybeSingle();
          if (p) setPatientName(`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim());
        }
      });
  }, [appointmentId]);

  // Sem contexto de consulta: carrega os pacientes do médico (com quem já teve
  // consulta) para ele escolher a quem o exame se destina.
  useEffect(() => {
    if (appointmentId || !doctorProfileId) return;
    (async () => {
      const { data: appts } = await db
        .from("appointments")
        .select("patient_id")
        .eq("doctor_id", doctorProfileId)
        .not("patient_id", "is", null);
      const ids = [...new Set(((appts as any[]) ?? []).map((a) => a.patient_id).filter(Boolean))];
      if (ids.length === 0) { setPatients([]); return; }
      const { data: profs } = await db.from("profiles").select("user_id, first_name, last_name").in("user_id", ids);
      setPatients(((profs as any[]) ?? []).map((p) => ({
        id: p.user_id,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Paciente",
      })));
    })();
  }, [appointmentId, doctorProfileId]);

  const toggleExame = (e: string) => {
    setExamType((prev) => {
      const linhas = parseLinhas(prev);
      return linhas.includes(e) ? linhas.filter((l) => l !== e).join("\n") : [...linhas, e].join("\n");
    });
  };

  // Adiciona vários exames à seleção atual, sem duplicar os já presentes.
  const addExames = (novos: string[]) => {
    setExamType((prev) => {
      const linhas = parseLinhas(prev);
      const vistos = new Set(linhas);
      novos.forEach((e) => {
        const t = e.trim();
        if (t && !vistos.has(t)) { vistos.add(t); linhas.push(t); }
      });
      return linhas.join("\n");
    });
  };

  const persistFavorites = (list: ExamFavorite[]) => {
    setFavorites(list);
    if (user) saveFavorites(user.id, list);
  };

  const saveCurrentFavorite = () => {
    const exames = parseLinhas(examType);
    if (exames.length === 0) { toast.error("Adicione exames antes de salvar um favorito."); return; }
    const name = favName.trim();
    if (!name) { toast.error("Dê um nome ao favorito."); return; }
    const novo: ExamFavorite = { id: crypto.randomUUID(), name, exames, created_at: new Date().toISOString() };
    persistFavorites([novo, ...favorites]);
    setSavingFav(false);
    setFavName("");
    toast.success("Favorito salvo!", { description: `"${name}" disponível nos próximos pedidos.` });
  };

  const applyFavorite = (f: ExamFavorite) => {
    addExames(f.exames);
    toast.success(`Favorito "${f.name}" aplicado.`);
  };

  const deleteFavorite = (id: string) => {
    persistFavorites(favorites.filter((f) => f.id !== id));
  };

  const submit = async () => {
    if (!doctorProfileId) { toast.error("Perfil médico não encontrado."); return; }
    if (!patientId) { toast.error("Selecione o paciente para quem é o exame."); return; }
    if (!examType.trim()) { toast.error("Informe ao menos um exame."); return; }
    setSaving(true);
    try {
      const { error } = await db.from("exam_requests").insert({
        patient_id: patientId,
        requesting_doctor_id: doctorProfileId,
        exam_type: examType.trim(),
        clinical_info: clinicalInfo.trim() || null,
        priority,
        status: "pending",
      });
      if (error) throw error;
      setDone(true);
      toast.success("Pedido de exame registrado! ✅");
    } catch (e) {
      logError("exam_request insert", e);
      toast.error("Não foi possível salvar o pedido.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Solicitar Exame" nav={getDoctorNav("exam-request")} role="doctor">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" /> Solicitar Exame
            </CardTitle>
            {patientName && <p className="text-sm text-muted-foreground">Paciente: <strong>{patientName}</strong></p>}
          </CardHeader>
          <CardContent className="space-y-4">
            {done ? (
              <div className="text-center py-8 space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="font-semibold">Pedido de exame registrado.</p>
                <p className="text-sm text-muted-foreground">O paciente verá a solicitação no painel dele.</p>
                <Button variant="outline" onClick={() => { setDone(false); setExamType(""); setClinicalInfo(""); }}>Novo pedido</Button>
              </div>
            ) : (
              <>
                {!appointmentId && (
                  <div>
                    <Label className="mb-2 block">Paciente</Label>
                    <Select value={patientId ?? ""} onValueChange={(v) => { setPatientId(v); setPatientName(patients.find((p) => p.id === v)?.name ?? ""); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                      <SelectContent>
                        {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {patients.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Você ainda não tem pacientes com consultas registradas. Abra o pedido pelo prontuário/consulta do paciente.
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <Label className="mb-2 block">Exames comuns (clique para adicionar)</Label>
                  <div className="flex flex-wrap gap-2">
                    {EXAMES_COMUNS.map((e) => {
                      const ativo = examType.split("\n").map((l) => l.trim()).includes(e);
                      return (
                        // UI: aria-pressed communicates toggle state to screen readers
                        <button key={e} type="button" onClick={() => toggleExame(e)} aria-pressed={ativo}
                          className={`text-xs px-3 py-1.5 rounded-full border transition ${ativo ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"}`}>
                          {e}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 flex items-center gap-1.5"><Layers className="w-4 h-4 text-primary" /> Painéis (adiciona vários de uma vez)</Label>
                  <div className="flex flex-wrap gap-2">
                    {PAINEIS.map((p) => (
                      <button key={p.nome} type="button" onClick={() => addExames(p.exames)}
                        title={p.exames.join(", ")}
                        className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition font-medium">
                        + {p.nome}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-500" /> Meus favoritos</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {favorites.map((f) => (
                      // UI: chip aplica o favorito; botão interno exclui sem disparar a aplicação
                      <span key={f.id} className="inline-flex items-center rounded-full border border-input bg-background text-xs overflow-hidden">
                        <button type="button" onClick={() => applyFavorite(f)} title={f.exames.join(", ")}
                          className="pl-3 pr-2 py-1.5 hover:bg-muted transition">
                          {f.name} <span className="text-muted-foreground">({f.exames.length})</span>
                        </button>
                        <button type="button" onClick={() => deleteFavorite(f.id)} aria-label={`Excluir favorito ${f.name}`}
                          className="px-1.5 py-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {!savingFav ? (
                      <button type="button" onClick={() => setSavingFav(true)}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-dashed border-input text-muted-foreground hover:bg-muted transition">
                        <Plus className="w-3 h-3" /> Salvar seleção atual
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Input autoFocus value={favName} onChange={(e) => setFavName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveCurrentFavorite(); if (e.key === "Escape") { setSavingFav(false); setFavName(""); } }}
                          placeholder="Nome do favorito" className="h-8 w-44 text-xs" />
                        <Button type="button" size="sm" className="h-8 gap-1" onClick={saveCurrentFavorite}>
                          <Save className="w-3.5 h-3.5" /> Salvar
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setSavingFav(false); setFavName(""); }} aria-label="Cancelar">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </span>
                    )}
                    {favorites.length === 0 && !savingFav && (
                      <span className="text-xs text-muted-foreground">Nenhum favorito ainda.</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="exames">Exames solicitados (um por linha)</Label>
                  <Textarea id="exames" rows={5} value={examType} onChange={(e) => setExamType(e.target.value)} placeholder="Ex.: Hemograma completo&#10;Glicemia de jejum" className="mt-1 font-mono text-sm" />
                </div>
                <div>
                  <Label htmlFor="info">Informação clínica / indicação (opcional)</Label>
                  <Textarea id="info" rows={3} value={clinicalInfo} onChange={(e) => setClinicalInfo(e.target.value)} placeholder="Hipótese diagnóstica, sintomas relevantes..." className="mt-1" />
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={submit} disabled={saving} className="w-full gap-2">
                  <Send className="w-4 h-4" /> {saving ? "Salvando..." : "Registrar pedido de exame"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ExamRequestForm;
