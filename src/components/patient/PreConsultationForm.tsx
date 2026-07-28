import { useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ClipboardList, Plus, X, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface PreConsultationFormProps {
  appointmentId: string;
  onComplete: () => void;
}

const COMMON_SYMPTOMS = [
  "Dor de cabeça", "Febre", "Tosse", "Dor de garganta", "Fadiga",
  "Náusea", "Tontura", "Dor abdominal", "Falta de ar", "Dor no peito",
  "Insônia", "Ansiedade", "Dor muscular", "Alergia", "Dor nas costas",
];

const PreConsultationForm = ({ appointmentId, onComplete }: PreConsultationFormProps) => {
  const { user } = useAuth();
  
  const [mainComplaint, setMainComplaint] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState("moderate");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const addCustomSymptom = () => {
    if (customSymptom.trim() && !selectedSymptoms.includes(customSymptom.trim())) {
      setSelectedSymptoms(prev => [...prev, customSymptom.trim()]);
      setCustomSymptom("");
    }
  };

  const handleSubmit = async () => {
    if (!mainComplaint.trim() || !user) return;
    setSaving(true);

    const { error } = await db.from("pre_consultation_symptoms").insert({
      appointment_id: appointmentId,
      patient_id: user.id,
      main_complaint: mainComplaint.trim(),
      symptoms: selectedSymptoms,
      duration: duration || null,
      severity,
      additional_notes: notes.trim() || null,
    });

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Sintomas registrados! ✅", { description: "O médico terá acesso antes da consulta." });
      onComplete();
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Questionário Pré-Consulta
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Preencha seus sintomas para o médico revisar antes do atendimento
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main complaint */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Queixa principal *
            </label>
            <Input
              placeholder="Ex: Dor de cabeça intensa há 3 dias"
              value={mainComplaint}
              onChange={e => setMainComplaint(e.target.value)}
            />
          </div>

          {/* Symptom chips */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Sintomas associados
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_SYMPTOMS.map(s => (
                <Badge
                  key={s}
                  variant={selectedSymptoms.includes(s) ? "default" : "outline"}
                  className="cursor-pointer text-xs transition-all"
                  onClick={() => toggleSymptom(s)}
                >
                  {selectedSymptoms.includes(s) && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {s}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar outro sintoma..."
                value={customSymptom}
                onChange={e => setCustomSymptom(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomSymptom())}
                className="flex-1"
              />
              <Button size="sm" variant="outline" onClick={addCustomSymptom} disabled={!customSymptom.trim()} aria-label="Adicionar sintoma">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {selectedSymptoms.filter(s => !COMMON_SYMPTOMS.includes(s)).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedSymptoms.filter(s => !COMMON_SYMPTOMS.includes(s)).map(s => (
                  <Badge key={s} className="gap-1 text-xs">
                    {s}
                    <button onClick={() => toggleSymptom(s)} aria-label="Remover sintoma"><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Duration + Severity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Há quanto tempo?</label>
              <Input placeholder="Ex: 3 dias" value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Intensidade</label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild">🟢 Leve</SelectItem>
                  <SelectItem value="moderate">🟡 Moderada</SelectItem>
                  <SelectItem value="severe">🟠 Forte</SelectItem>
                  <SelectItem value="very_severe">🔴 Muito forte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional notes */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Observações adicionais</label>
            <Textarea
              placeholder="Medicamentos em uso, alergias, informações relevantes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            className="w-full bg-gradient-hero text-primary-foreground"
            onClick={handleSubmit}
            disabled={!mainComplaint.trim() || saving}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {saving ? "Salvando..." : "Enviar para o médico"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PreConsultationForm;
