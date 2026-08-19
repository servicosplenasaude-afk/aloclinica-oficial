import { useState, useEffect, useCallback } from "react";
import { db } from "@/integrations/supabase/untyped";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User, Heart, AlertTriangle, Droplets, FileText, Stethoscope,
  ChevronDown, ChevronUp, Clock, Pill, Activity, Calendar,
  Phone, CreditCard, Shield
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface PatientInfoPanelProps {
  patientId: string;
  appointmentId: string;
}

interface PatientData {
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  blood_type: string | null;
  allergies: string[];
  chronic_conditions: string[];
  phone: string | null;
  cpf: string | null;
}

interface PreConsultationData {
  main_complaint: string;
  symptoms: string[];
  severity: string;
  duration: string;
  additional_notes: string | null;
}

interface PastConsultation {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
}

interface PrescriptionData {
  id: string;
  diagnosis: string | null;
  medications: any[];
  created_at: string;
}

const severityConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  mild: { color: "text-[hsl(150,60%,55%)]", bg: "bg-[hsl(150,60%,40%,0.1)]", border: "border-[hsl(150,60%,40%,0.2)]", label: "Leve" },
  moderate: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Moderado" },
  severe: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", label: "Grave" },
};

const PatientInfoPanel = ({ patientId, appointmentId }: PatientInfoPanelProps) => {
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [preConsult, setPreConsult] = useState<PreConsultationData | null>(null);
  const [pastConsults, setPastConsults] = useState<PastConsultation[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    symptoms: true,
    health: true,
    history: false,
    prescriptions: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchAllData = useCallback(async () => {
    const [profileRes, symptomsRes, pastRes, prescRes] = await Promise.all([
      db.from("profiles")
        .select("first_name, last_name, date_of_birth, blood_type, allergies, chronic_conditions, phone, cpf")
        .eq("user_id", patientId)
        .single(),
      db.from("pre_consultation_symptoms")
        .select("main_complaint, symptoms, severity, duration, additional_notes")
        .eq("appointment_id", appointmentId)
        .single(),
      db.from("appointments")
        .select("id, scheduled_at, status, notes")
        .eq("patient_id", patientId)
        .eq("status", "completed")
        .neq("id", appointmentId)
        .order("scheduled_at", { ascending: false })
        .limit(5),
      db.from("prescriptions")
        .select("id, diagnosis, medications, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (profileRes.data) setPatient(profileRes.data as unknown as PatientData);
    if (symptomsRes.data) setPreConsult(symptomsRes.data as unknown as PreConsultationData);
    if (pastRes.data) setPastConsults(pastRes.data);
    if (prescRes.data) setPrescriptions(prescRes.data as unknown as PrescriptionData[]);
    setLoading(false);
  }, [appointmentId, patientId]);

  useEffect(() => {
    if (!patientId) return;
    fetchAllData();
  }, [patientId, fetchAllData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="shimmer-v2 h-5 rounded w-32 inline-block" aria-label="Carregando" />
        </div>
      </div>
    );
  }

  const age = patient?.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const hasAlerts = (patient?.allergies?.length ?? 0) > 0 || (patient?.chronic_conditions?.length ?? 0) > 0;

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-3">
        {/* Patient header card */}
        {patient && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[hsl(220,20%,10%)] to-[hsl(220,20%,8%)] border border-[hsl(220,15%,15%)] shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">
                  {patient.first_name} {patient.last_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {age && (
                    <span className="text-[11px] text-[hsl(220,15%,50%)] flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />{age} anos
                    </span>
                  )}
                  {patient.blood_type && (
                    <span className="text-[11px] text-red-400 flex items-center gap-1 font-medium">
                      <Droplets className="w-2.5 h-2.5" />{patient.blood_type}
                    </span>
                  )}
                  {patient.phone && (
                    <span className="text-[11px] text-[hsl(220,15%,45%)] flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5" />{patient.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick alert badges */}
            {hasAlerts && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[hsl(220,15%,13%)]">
                {patient?.allergies?.map((a, i) => (
                  <span key={`a-${i}`} className="text-[10px] px-2 py-0.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />{a}
                  </span>
                ))}
                {patient?.chronic_conditions?.map((c, i) => (
                  <span key={`c-${i}`} className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <Activity className="w-2.5 h-2.5" />{c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pre-consultation symptoms */}
        <Section
          title="Sintomas Pré-consulta"
          icon={<Stethoscope className="w-3.5 h-3.5" />}
          expanded={expandedSections.symptoms}
          onToggle={() => toggleSection("symptoms")}
          highlight={!!preConsult}
          count={preConsult?.symptoms?.length}
        >
          {preConsult ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)]">
                <p className="text-[10px] uppercase tracking-wider text-[hsl(220,15%,40%)] font-semibold mb-1.5">Queixa principal</p>
                <p className="text-sm text-white leading-relaxed">{preConsult.main_complaint}</p>
              </div>

              <div className="flex items-center gap-2">
                {preConsult.severity && (() => {
                  const sev = severityConfig[preConsult.severity];
                  return sev ? (
                    <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold ${sev.bg} ${sev.color} border ${sev.border}`}>
                      ● {sev.label}
                    </span>
                  ) : null;
                })()}
                {preConsult.duration && (
                  <span className="text-[10px] px-2.5 py-1 rounded-lg bg-[hsl(220,20%,10%)] text-[hsl(220,15%,55%)] border border-[hsl(220,15%,15%)] flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />{preConsult.duration}
                  </span>
                )}
              </div>

              {preConsult.symptoms && preConsult.symptoms.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {preConsult.symptoms.map((s, i) => (
                    <span key={i} className="text-[10px] px-2.5 py-1 rounded-lg bg-primary/8 text-primary border border-primary/15 font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {preConsult.additional_notes && (
                <div className="p-2.5 rounded-lg bg-[hsl(220,20%,7%)] border-l-2 border-primary/30">
                  <p className="text-xs text-[hsl(220,15%,55%)] italic leading-relaxed">"{preConsult.additional_notes}"</p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center">
              <Stethoscope className="w-6 h-6 text-[hsl(220,15%,20%)] mx-auto mb-2" />
              <p className="text-xs text-[hsl(220,15%,35%)]">Paciente não preencheu sintomas</p>
            </div>
          )}
        </Section>

        {/* Health info */}
        <Section
          title="Perfil de Saúde"
          icon={<Heart className="w-3.5 h-3.5" />}
          expanded={expandedSections.health}
          onToggle={() => toggleSection("health")}
          alert={hasAlerts}
        >
          <div className="space-y-3">
            {/* Allergies */}
            <div className="p-3 rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)]">
              <p className="text-[10px] uppercase tracking-wider text-destructive font-semibold flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3 h-3" /> Alergias
              </p>
              {patient?.allergies && patient.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {patient.allergies.map((a, i) => (
                    <span key={i} className="text-[10px] px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[hsl(220,15%,35%)]">Nenhuma alergia registrada ✓</p>
              )}
            </div>

            {/* Chronic conditions */}
            <div className="p-3 rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)]">
              <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5 mb-2">
                <Activity className="w-3 h-3" /> Condições Crônicas
              </p>
              {patient?.chronic_conditions && patient.chronic_conditions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {patient.chronic_conditions.map((c, i) => (
                    <span key={i} className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[hsl(220,15%,35%)]">Nenhuma condição crônica ✓</p>
              )}
            </div>

            {patient?.blood_type && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)]">
                <Droplets className="w-4 h-4 text-red-400" />
                <p className="text-xs text-[hsl(220,15%,60%)]">Tipo sanguíneo</p>
                <span className="text-sm font-bold text-white ml-auto">{patient.blood_type}</span>
              </div>
            )}
          </div>
        </Section>

        {/* Past consultations */}
        <Section
          title="Histórico"
          icon={<Clock className="w-3.5 h-3.5" />}
          expanded={expandedSections.history}
          onToggle={() => toggleSection("history")}
          count={pastConsults.length}
        >
          {pastConsults.length > 0 ? (
            <div className="space-y-2">
              {pastConsults.map(c => (
                <div key={c.id} className="p-3 rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] hover:border-[hsl(220,15%,18%)] transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-[hsl(220,15%,50%)] flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {format(new Date(c.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(150,60%,40%,0.1)] text-[hsl(150,60%,50%)] border border-[hsl(150,60%,40%,0.15)]">
                      Concluída
                    </span>
                  </div>
                  {c.notes && <p className="text-xs text-[hsl(220,15%,65%)] mt-1.5 line-clamp-2 leading-relaxed">{c.notes}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center">
              <Clock className="w-6 h-6 text-[hsl(220,15%,20%)] mx-auto mb-2" />
              <p className="text-xs text-[hsl(220,15%,35%)]">Primeira consulta</p>
            </div>
          )}
        </Section>

        {/* Recent prescriptions */}
        <Section
          title="Receitas"
          icon={<Pill className="w-3.5 h-3.5" />}
          expanded={expandedSections.prescriptions}
          onToggle={() => toggleSection("prescriptions")}
          count={prescriptions.length}
        >
          {prescriptions.length > 0 ? (
            <div className="space-y-2">
              {prescriptions.map(p => (
                <div key={p.id} className="p-3 rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] hover:border-[hsl(220,15%,18%)] transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-[hsl(220,15%,50%)]">
                      {format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                    <span className="text-[10px] text-[hsl(220,15%,40%)]">
                      {Array.isArray(p.medications) ? `${p.medications.length} med.` : ""}
                    </span>
                  </div>
                  {p.diagnosis && <p className="text-xs text-white font-medium mt-1">{p.diagnosis}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center">
              <Pill className="w-6 h-6 text-[hsl(220,15%,20%)] mx-auto mb-2" />
              <p className="text-xs text-[hsl(220,15%,35%)]">Sem receitas anteriores</p>
            </div>
          )}
        </Section>

        {/* Security footer */}
        <div className="p-3 rounded-xl bg-[hsl(150,40%,6%)] border border-[hsl(150,40%,15%)] flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-[hsl(150,60%,45%)] shrink-0" />
          <div>
            <p className="text-[11px] font-medium text-[hsl(150,60%,55%)]">Dados protegidos</p>
            <p className="text-[10px] text-[hsl(150,40%,35%)]">LGPD · CFM 2.314/22 · Criptografia E2E</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

// Collapsible section component
const Section = ({
  title, icon, expanded, onToggle, highlight, alert, count, children,
}: {
  title: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void;
  highlight?: boolean; alert?: boolean; count?: number; children: React.ReactNode;
}) => (
  <div className={`rounded-2xl border transition-colors ${
    highlight ? "border-primary/25 bg-primary/3" :
    alert ? "border-destructive/20 bg-destructive/3" :
    "border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7%)]"
  }`}>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 text-left group"
    >
      <div className="flex items-center gap-2.5">
        <span className={`${highlight ? "text-primary" : alert ? "text-destructive" : "text-[hsl(220,15%,45%)]"} group-hover:text-white transition-colors`}>
          {icon}
        </span>
        <span className="text-xs font-semibold text-[hsl(220,15%,75%)] group-hover:text-white transition-colors">{title}</span>
        {highlight && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
        {alert && !highlight && <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />}
        {typeof count === "number" && count > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[hsl(220,20%,12%)] text-[hsl(220,15%,50%)] font-medium">
            {count}
          </span>
        )}
      </div>
      <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
        <ChevronDown className="w-3.5 h-3.5 text-[hsl(220,15%,35%)] group-hover:text-[hsl(220,15%,55%)] transition-colors" />
      </motion.div>
    </button>
    <AnimatePresence>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default PatientInfoPanel;
