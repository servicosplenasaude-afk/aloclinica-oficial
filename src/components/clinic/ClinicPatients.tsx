import { useState, useEffect } from "react";
import mascotWelcome from "@/assets/states/pingo-clinica-pacientes.webp";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Users, Search, Calendar, Download, MessageCircle, Phone, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/csv";
import { getClinicNav } from "./clinicNav";

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } } };

interface PatientRow {
  user_id: string;
  name: string;
  phone?: string;
  totalAppts: number;
  lastVisit?: string;
}

const ClinicPatients = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PatientRow | null>(null);

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const { data: clinic } = await db.from("clinic_profiles").select("id").eq("user_id", user!.id).single();
    if (!clinic) { setLoading(false); return; }

    const { data: affiliations } = await db.from("clinic_affiliations").select("doctor_id").eq("clinic_id", clinic.id).eq("status", "active");
    const doctorIds = (affiliations ?? []).map(a => a.doctor_id);
    if (doctorIds.length === 0) { setLoading(false); return; }

    const { data: appts } = await db.from("appointments")
      .select("patient_id, scheduled_at, status")
      .in("doctor_id", doctorIds)
      .not("patient_id", "is", null)
      .order("scheduled_at", { ascending: false });

    // Group by patient
    const patientMap = new Map<string, { count: number; lastVisit: string }>();
    (appts ?? []).forEach(a => {
      if (!a.patient_id) return;
      const existing = patientMap.get(a.patient_id);
      if (!existing) {
        patientMap.set(a.patient_id, { count: 1, lastVisit: a.scheduled_at });
      } else {
        existing.count++;
      }
    });

    const patientIds = [...patientMap.keys()];
    if (patientIds.length === 0) { setPatients([]); setLoading(false); return; }

    const { data: profiles } = await db.from("profiles").select("user_id, first_name, last_name, phone").in("user_id", patientIds);

    const rows: PatientRow[] = patientIds.map(pid => {
      const profile = (profiles ?? []).find(p => p.user_id === pid);
      const stats = patientMap.get(pid)!;
      return {
        user_id: pid,
        name: profile ? `${profile.first_name} ${profile.last_name}` : "Paciente",
        phone: profile?.phone ?? undefined,
        totalAppts: stats.count,
        lastVisit: stats.lastVisit,
      };
    }).sort((a, b) => b.totalAppts - a.totalAppts);

    setPatients(rows);
    setLoading(false);
  };

  const filtered = patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.phone ?? "").includes(search));

  const exportCsv = () => {
    if (filtered.length === 0) { toast.error("Nenhum paciente para exportar."); return; }
    const rows = filtered.map(p => ({
      nome: p.name,
      telefone: p.phone ?? "",
      consultas: p.totalAppts,
      ultima_visita: p.lastVisit ? new Date(p.lastVisit).toLocaleDateString("pt-BR") : "",
    }));
    exportToCSV("pacientes-clinica.csv", rows, [
      { key: "nome", label: "Nome" },
      { key: "telefone", label: "Telefone" },
      { key: "consultas", label: "Consultas" },
      { key: "ultima_visita", label: "Última visita" },
    ]);
    toast.success(`${rows.length} paciente${rows.length !== 1 ? "s" : ""} exportado${rows.length !== 1 ? "s" : ""}`);
  };

  // Abre o WhatsApp com o telefone do paciente (fallback: avisa quando indisponível).
  const openWhatsApp = (p: PatientRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!p.phone) { toast.error("Telefone não disponível para este paciente."); return; }
    const digits = p.phone.replace(/\D/g, "");
    const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
    const msg = encodeURIComponent(`Olá ${p.name.split(" ")[0]}, aqui é da clínica. `);
    window.open(`https://wa.me/${withCountry}?text=${msg}`, "_blank");
  };

  return (
    <DashboardLayout title="Pacientes" nav={getClinicNav("patients")} role="clinic">
      <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} className="max-w-4xl space-y-5">
        <motion.div variants={fadeUp} className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Pacientes da Clínica</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{patients.length} pacientes atendidos</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </motion.div>

        <motion.div variants={fadeUp} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="border-border/50">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3 pb-24 md:pb-8">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8">
              <img src={mascotWelcome} alt="Pingo" className="w-20 h-20 object-contain mx-auto mb-3 select-none" style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,.15))" }} loading="lazy" decoding="async" width={80} height={80} />
                  <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum paciente encontrado</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filtered.map(patient => (
                    <div key={patient.user_id} role="button" tabIndex={0} onClick={() => setSelected(patient)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(patient); } }} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors cursor-pointer focus:outline-none focus:bg-muted/30">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{patient.name}</p>
                        {patient.phone && <p className="text-xs text-muted-foreground">{patient.phone}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{patient.totalAppts} consulta{patient.totalAppts > 1 ? "s" : ""}</span>
                        </div>
                        {patient.lastVisit && (
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                            Última: {formatDistanceToNow(new Date(patient.lastVisit), { addSuffix: true, locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg shrink-0" onClick={e => openWhatsApp(patient, e)} title="Enviar mensagem no WhatsApp" aria-label="Enviar mensagem no WhatsApp">
                        <MessageCircle className="w-4 h-4 text-success" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Patient detail drawer */}
        <Sheet open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{selected?.name ?? "Paciente"}</SheetTitle>
              <SheetDescription>Detalhes do paciente</SheetDescription>
            </SheetHeader>
            {selected && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Contato</p>
                    <p className="text-sm font-medium text-foreground truncate">{selected.phone ?? "Não informado"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Calendar className="w-3 h-3" /> Consultas</div>
                    <p className="text-lg font-bold text-foreground mt-0.5">{selected.totalAppts}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock className="w-3 h-3" /> Última visita</div>
                    <p className="text-sm font-medium text-foreground mt-1">
                      {selected.lastVisit ? formatDistanceToNow(new Date(selected.lastVisit), { addSuffix: true, locale: ptBR }) : "—"}
                    </p>
                  </div>
                </div>
                <Button className="w-full rounded-xl" onClick={() => openWhatsApp(selected)}>
                  <MessageCircle className="w-4 h-4 mr-1.5" /> Mensagem no WhatsApp
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </motion.div>
    </DashboardLayout>
  );
};

export default ClinicPatients;
