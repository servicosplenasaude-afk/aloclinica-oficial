import { useState } from "react";
import { Search, QrCode, Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/integrations/supabase/untyped";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FoundPrescription {
  id: string;
  patient_name: string;
  doctor_name: string;
  diagnosis: string | null;
  medications: string[];
  created_at: string;
}

export function PrescriptionFinder({ onValidated }: { onValidated?: () => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<FoundPrescription | null>(null);
  const [dispensing, setDispensing] = useState(false);

  const search = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setFound(null);
    try {
      const { data } = await db.from("prescriptions")
        .select("id, diagnosis, medications, created_at, doctor_id, patient_id")
        .ilike("id", `${code.trim()}%`).limit(1).single();

      if (!data) { toast.error("Receita não encontrada"); setLoading(false); return; }

      const [docRes, patRes] = await Promise.all([
        db.from("doctor_profiles").select("user_id").eq("id", data.doctor_id).single(),
        db.from("profiles").select("first_name, last_name").eq("user_id", data.patient_id).single(),
      ]);
      let doctorName = "—";
      if (docRes.data) {
        const { data: dp } = await db.from("profiles").select("first_name, last_name").eq("user_id", docRes.data.user_id).single();
        if (dp) doctorName = `Dr(a). ${dp.first_name} ${dp.last_name}`;
      }
      setFound({ ...data, doctor_name: doctorName, patient_name: patRes.data ? `${patRes.data.first_name} ${patRes.data.last_name}` : "—", medications: Array.isArray(data.medications) ? (data.medications as string[]) : [] });
    } catch { toast.error("Receita não encontrada. Verifique o código."); }
    setLoading(false);
  };

  const dispense = async () => {
    if (!found) return;
    setDispensing(true);
    try {
      await db.from("prescription_validations").insert([{ prescription_id: found.id, validated_by: "partner", status: "dispensed", notes: "Dispensado pelo parceiro" }]);
      toast.success("Receita dispensada com sucesso!");
      setFound(null); setCode("");
      onValidated?.();
    } catch { toast.error("Erro ao dispensar"); }
    setDispensing(false);
  };

  return (
    <div className="rounded-2xl border border-border/25 bg-card p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Consultar receita digital</p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
            placeholder="Código da receita (ID)..."
            className="h-11 rounded-xl border-border/40 pl-9 text-sm" />
        </div>
        <Button onClick={search} disabled={loading || !code.trim()} className="h-11 rounded-xl bg-[#0B5F4A] px-4 text-sm font-semibold text-white hover:bg-[#0B5F4A]/90" aria-label="Buscar receita">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        <Button variant="outline" onClick={() => toast.info("Scanner QR em desenvolvimento")} className="h-11 w-11 rounded-xl border-border/40 p-0" aria-label="Escanear QR code">
          <QrCode className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <AnimatePresence>
        {found && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 dark:border-emerald-800/40 dark:bg-emerald-950/20"
          >
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Receita autêntica</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">{found.id.slice(0, 12)}...</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><p className="text-muted-foreground/60">Paciente</p><p className="font-semibold text-foreground">{found.patient_name}</p></div>
              <div><p className="text-muted-foreground/60">Médico</p><p className="font-semibold text-foreground">{found.doctor_name}</p></div>
              <div><p className="text-muted-foreground/60">Data</p><p className="font-semibold text-foreground">{format(new Date(found.created_at), "dd/MM/yyyy", { locale: ptBR })}</p></div>
              <div><p className="text-muted-foreground/60">Diagnóstico</p><p className="truncate font-semibold text-foreground">{found.diagnosis ?? "—"}</p></div>
            </div>
            {found.medications.length > 0 && (
              <div className="mt-2.5 border-t border-emerald-200/60 dark:border-emerald-800/30 pt-2.5">
                <p className="mb-1.5 text-[10px] font-semibold text-muted-foreground/60">Medicamentos</p>
                <div className="flex flex-wrap gap-1.5">
                  {found.medications.map((m, i) => (
                    <span key={i} className="rounded-lg bg-white/70 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">{String(m)}</span>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={dispense} disabled={dispensing} className="mt-3 w-full h-10 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700">
              {dispensing ? <Loader2 className="h-4 w-4 animate-spin" /> : "✓ Confirmar Dispensação"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
