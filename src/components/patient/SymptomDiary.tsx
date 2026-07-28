import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getPatientNav } from "./patientNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const MOODS = [
  { key: "great", emoji: "😃", label: "Ótimo", color: "bg-success/20 border-success/40 text-success" },
  { key: "good", emoji: "🙂", label: "Bem", color: "bg-primary/20 border-primary/40 text-primary" },
  { key: "neutral", emoji: "😐", label: "Normal", color: "bg-muted border-border text-muted-foreground" },
  { key: "bad", emoji: "🤕", label: "Mal", color: "bg-warning/20 border-warning/40 text-warning" },
  { key: "terrible", emoji: "🤒", label: "Péssimo", color: "bg-destructive/20 border-destructive/40 text-destructive" },
];

const COMMON_SYMPTOMS = [
  "Dor de cabeça", "Febre", "Cansaço", "Náusea", "Insônia",
  "Dor muscular", "Tosse", "Ansiedade", "Tontura", "Falta de ar",
];

interface DiaryEntry {
  id: string;
  entry_date: string;
  mood: string;
  symptoms: string[];
  notes: string | null;
}

const MOOD_SCORE: Record<string, number> = { great: 5, good: 4, neutral: 3, bad: 2, terrible: 1 };

const SymptomDiary = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [mood, setMood] = useState("neutral");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchEntries();
  }, [user, currentMonth]);

  useEffect(() => {
    // Load entry for selected date
    const entry = entries.find(e => e.entry_date === format(selectedDate, "yyyy-MM-dd"));
    if (entry) {
      setMood(entry.mood);
      setSymptoms(entry.symptoms || []);
      setNotes(entry.notes || "");
    } else {
      setMood("neutral");
      setSymptoms([]);
      setNotes("");
    }
  }, [selectedDate, entries]);

  const fetchEntries = async () => {
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
    const { data } = await db
      .from("symptom_diary")
      .select("*")
      .eq("patient_id", user!.id)
      .gte("entry_date", start)
      .lte("entry_date", end);
    setEntries((data as DiaryEntry[]) ?? []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const existing = entries.find(e => e.entry_date === dateStr);

    if (existing) {
      await db.from("symptom_diary").update({ mood, symptoms, notes: notes || null }).eq("id", existing.id);
    } else {
      await db.from("symptom_diary").insert({
        patient_id: user.id,
        entry_date: dateStr,
        mood,
        symptoms,
        notes: notes || null,
      });
    }
    toast.success("Registro salvo!");
    setSaving(false);
    fetchEntries();
  };

  const toggleSymptom = (s: string) => {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getMoodForDay = (day: Date) => {
    const entry = entries.find(e => e.entry_date === format(day, "yyyy-MM-dd"));
    if (!entry) return null;
    return MOODS.find(m => m.key === entry.mood);
  };

  return (
    <DashboardLayout title="Paciente" nav={getPatientNav("diary")}>
      <div className="w-full mx-auto max-w-3xl space-y-5 pb-24 md:pb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tabular-nums">Diário de Sintomas</h1>
          <p className="text-sm text-muted-foreground">Registre como você se sente diariamente para auxiliar seus médicos</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Calendar */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Mês anterior">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <CardTitle className="text-sm capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Próximo mês">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                  <span key={i} className="text-[10px] text-muted-foreground font-medium">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: days[0].getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {days.map(day => {
                  const moodData = getMoodForDay(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const future = isFuture(day) && !isToday(day);
                  return (
                    <button
                      key={day.toISOString()}
                      disabled={future}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all
                        ${isSelected ? "ring-2 ring-primary bg-primary/10" : "hover:bg-muted/50"}
                        ${future ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                        ${isToday(day) && !isSelected ? "border border-primary/30" : ""}
                      `}
                    >
                      <span className="text-[10px] text-muted-foreground">{format(day, "d")}</span>
                      {moodData && <span className="text-sm leading-none">{moodData.emoji}</span>}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Entry form */}
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mood */}
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">Como você está?</p>
                  <div className="flex gap-2">
                    {MOODS.map(m => (
                      <button
                        key={m.key}
                        onClick={() => setMood(m.key)}
                        className={`flex-1 p-2 rounded-xl border-2 transition-all text-center ${
                          mood === m.key ? m.color + " scale-105 shadow-sm" : "border-border/50 hover:border-border"
                        }`}
                      >
                        <span className="text-xl block">{m.emoji}</span>
                        <span className="text-[9px] block mt-0.5">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Symptoms */}
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">Sintomas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_SYMPTOMS.map(s => (
                      <Badge
                        key={s}
                        variant={symptoms.includes(s) ? "default" : "outline"}
                        className={`cursor-pointer text-[10px] transition-all ${
                          symptoms.includes(s) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        }`}
                        onClick={() => toggleSymptom(s)}
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">Observações</p>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Detalhes adicionais..."
                    className="text-sm min-h-[60px]"
                    maxLength={500}
                  />
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-hero text-primary-foreground">
                  {saving ? "Salvando..." : "💾 Salvar Registro"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Mood chart */}
        {entries.length >= 3 && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" /> Evolução do Humor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={entries.sort((a, b) => a.entry_date.localeCompare(b.entry_date)).map(e => ({
                  date: format(new Date(e.entry_date + "T12:00:00"), "dd/MM"),
                  humor: MOOD_SCORE[e.mood] ?? 3,
                  sintomas: (e.symptoms?.length ?? 0),
                }))}>
                  <defs>
                    <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [
                      name === "humor" ? ["Péssimo", "Mal", "Normal", "Bem", "Ótimo"][value - 1] : `${value} sintomas`,
                      name === "humor" ? "Humor" : "Sintomas"
                    ]}
                  />
                  <Area type="monotone" dataKey="humor" stroke="hsl(var(--primary))" fill="url(#moodGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SymptomDiary;
