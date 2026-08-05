import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getDoctorNav } from "./doctorNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Eye, CheckCircle2, XCircle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notifyRenewalApproved, notifyRenewalRejected } from "@/lib/notifications-queue";

import type { Json } from "@/integrations/supabase/types";

// A renewal is "fresh" (paid, not yet assumed by a doctor) under any of these
// statuses. "in_review" means a doctor already claimed it.
const FRESH_RENEWAL_STATUSES = ["pending", "pending_review", "paid"];
const isFreshRenewal = (status: string) => FRESH_RENEWAL_STATUSES.includes(status);

interface RenewalItem {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  prescription_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  assigned_doctor_id: string | null;
  original_prescription_url: string | null;
  health_questionnaire: Json;
  rejection_reason: string | null;
  // Campos derivados no cliente (não vêm do banco)
  patientName?: string;
  medication?: string;
  isOwnPatient?: boolean;
}

const RenewalQueue = () => {
  const { user } = useAuth();
  const [renewals, setRenewals] = useState<RenewalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorProfileId, setDoctorProfileId] = useState<string | null>(null);
  const [selectedRenewal, setSelectedRenewal] = useState<RenewalItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const docId = await fetchDoctorProfile();
      await fetchRenewals(docId);
    })();
  }, [user]);

  const fetchDoctorProfile = async (): Promise<string | null> => {
    if (!user) return null;
    const { data } = await db.from("doctor_profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (data) { setDoctorProfileId(data.id); return data.id; }
    return null;
  };

  const fetchRenewals = async (docId: string | null = doctorProfileId) => {
    const { data } = await db
      .from("prescription_renewals")
      .select("*")
      // Paid renewals arrive with different statuses depending on the payment
      // path: card → "pending_review", PIX/boleto webhook → "paid", free quick
      // renewal → "pending". ALL of these are paid-and-awaiting-a-doctor and must
      // show here (previously only "pending"/"in_review" did, orphaning paid ones).
      .in("status", ["pending", "pending_review", "paid", "in_review"])
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as RenewalItem[];

    // Resolve nomes de pacientes (patient_id → profiles.user_id), medicamentos
    // solicitados (receita vinculada ou questionário) e a marcação de "paciente próprio".
    const patientIds = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
    const prescriptionIds = [...new Set(rows.map(r => r.prescription_id).filter((id): id is string => !!id))];

    const [profilesRes, prescriptionsRes, ownPatients] = await Promise.all([
      patientIds.length
        ? db.from("profiles").select("user_id, first_name, last_name").in("user_id", patientIds)
        : Promise.resolve({ data: [] as any[] }),
      prescriptionIds.length
        ? db.from("prescriptions").select("id, medications").in("id", prescriptionIds)
        : Promise.resolve({ data: [] as any[] }),
      docId
        ? db.from("appointments").select("patient_id").eq("doctor_id", docId)
            .then(({ data: appts }) => new Set((appts ?? []).map((a: any) => a.patient_id).filter(Boolean)))
        : Promise.resolve(new Set<string>()),
    ]);

    const nameMap = new Map<string, string>(
      ((profilesRes as any).data ?? []).map((p: any) => [p.user_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()])
    );
    const medMap = new Map<string, any>(
      ((prescriptionsRes as any).data ?? []).map((p: any) => [p.id, p.medications])
    );

    const enriched = rows.map(r => {
      // Medicamento solicitado: prioriza a receita vinculada; senão, o questionário do paciente.
      let medication = "";
      const meds = r.prescription_id ? medMap.get(r.prescription_id) : null;
      if (Array.isArray(meds) && meds.length) {
        medication = meds
          .map((m: any) => (typeof m === "string" ? m : [m?.name, m?.dosage].filter(Boolean).join(" ")))
          .filter(Boolean)
          .join(", ");
      }
      if (!medication) {
        const q = (r.health_questionnaire || {}) as any;
        medication = String(q.current_medications ?? q.medications ?? "").trim();
      }
      return {
        ...r,
        patientName: nameMap.get(r.patient_id) || "Paciente",
        medication,
        isOwnPatient: ownPatients.has(r.patient_id),
      };
    });

    // Pacientes próprios primeiro; dentro de cada grupo, mais antigos primeiro (como antes).
    enriched.sort((a, b) => {
      if (a.isOwnPatient !== b.isOwnPatient) return a.isOwnPatient ? -1 : 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    setRenewals(enriched);
    setLoading(false);
  };

  const handleClaim = async (renewal: RenewalItem) => {
    if (!doctorProfileId) return;
    await db.from("prescription_renewals").update({
      status: "in_review",
      assigned_doctor_id: doctorProfileId,
    }).eq("id", renewal.id);
    toast.success("Renovação assumida!");
    fetchRenewals();
  };

  const getDoctorName = async () => {
    if (!user) return "Médico";
    const { data } = await db.from("profiles").select("first_name, last_name").eq("user_id", user.id).maybeSingle();
    return data ? `Dr(a). ${data.first_name} ${data.last_name}` : "Médico";
  };

  /**
   * Renovar em 1 clique: duplica a receita original com nova validade,
   * marca a renovação como approved e notifica o paciente. Funciona com
   * pending (auto-assume) ou in_review (já assumida).
   */
  const renewOneClick = async (renewal: RenewalItem) => {
    if (!doctorProfileId) return;
    setProcessing(true);
    try {
      if (!renewal.prescription_id) {
        toast.error("Receita original ausente — abra para análise manual.");
        setSelectedRenewal(renewal);
        return;
      }
      const { data: orig, error: origErr } = await db.from("prescriptions")
        .select("medications, diagnosis, instructions, prescription_type, observations, patient_id, appointment_id")
        .eq("id", renewal.prescription_id)
        .maybeSingle();
      if (origErr || !orig) throw origErr || new Error("Receita original não encontrada");

      const today = new Date();
      const validUntil = new Date(today); validUntil.setDate(validUntil.getDate() + 30);
      const verification = `RX-${today.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const { data: newRx, error: insErr } = await db.from("prescriptions")
        .insert({
          patient_id: (orig as any).patient_id ?? renewal.patient_id,
          doctor_id: doctorProfileId,
          appointment_id: (orig as any).appointment_id ?? null,
          medications: (orig as any).medications,
          diagnosis: (orig as any).diagnosis,
          instructions: (orig as any).instructions,
          prescription_type: (orig as any).prescription_type ?? "comum",
          observations: (orig as any).observations,
          status: "active",
          is_signed: false,
          verification_code: verification,
          valid_until: validUntil.toISOString().slice(0, 10),
        } as any)
        .select("id")
        .single();
      if (insErr) throw insErr;

      await db.from("prescription_renewals").update({
        status: "approved",
        reviewed_at: today.toISOString(),
        assigned_doctor_id: doctorProfileId,
        renewed_to_prescription_id: (newRx as any).id,
      } as any).eq("id", renewal.id);

      const docName = await getDoctorName();
      notifyRenewalApproved(renewal.patient_id, docName);

      toast.success("Renovação preparada", { description: "A nova receita precisa da sua assinatura digital para ter validade." });
      setSelectedRenewal(null);
      fetchRenewals();
    } catch (e: any) {
      toast.error("Não foi possível renovar", { description: e?.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (selectedRenewal) await renewOneClick(selectedRenewal);
  };

  const handleReject = async () => {
    if (!selectedRenewal) return;
    setProcessing(true);
    const reason = rejectionReason || "Não aprovada pelo médico";
    await db.from("prescription_renewals").update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    }).eq("id", selectedRenewal.id);
    
    // Notify patient
    const docName = await getDoctorName();
    notifyRenewalRejected(selectedRenewal.patient_id, docName, reason);
    
    toast.success("Renovação rejeitada.");
    setSelectedRenewal(null);
    setRejectionReason("");
    setProcessing(false);
    fetchRenewals();
  };

  const viewPrescription = async (url: string) => {
    const { data } = await db.storage.from("patient-documents").createSignedUrl(url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <DashboardLayout title="Médico" nav={getDoctorNav("renewal-queue")}>
      <div className="w-full mx-auto max-w-4xl pb-24 md:pb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">💊 Renovações de Receita</h1>
        <p className="text-muted-foreground text-sm mb-6">Analise e aprove solicitações de renovação</p>

        {loading ? <div className="shimmer-v2 h-20 rounded-2xl"/> : renewals.length === 0 ? (
          <Card><CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-foreground mb-1">Nenhuma renovação pendente</h3>
          </CardContent></Card>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto -mx-0.5 rounded-xl">

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Medicamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receita</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renewals.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">{r.patientName || "Paciente"}</span>
                        {r.isOwnPatient && (
                          <Badge variant="secondary" className="w-fit text-[10px] gap-0.5">
                            <UserCheck className="w-3 h-3" /> Seu paciente
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[220px]">
                      {r.medication
                        ? <span className="line-clamp-2">{r.medication}</span>
                        : <span className="italic text-muted-foreground/60">Não informado</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isFreshRenewal(r.status) ? "outline" : "default"}>
                        {isFreshRenewal(r.status) ? "Pendente" : "Em análise"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.original_prescription_url && (
                        <Button size="sm" variant="ghost" onClick={() => viewPrescription(r.original_prescription_url!)}>
                          <Eye className="w-3 h-3 mr-1" /> Ver
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.prescription_id && (
                        <Button size="sm" variant="default" disabled={processing} onClick={() => renewOneClick(r)} title="Duplica a receita anterior com 30 dias de validade">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Renovar 1-clique
                        </Button>
                      )}
                      {isFreshRenewal(r.status) && !r.prescription_id ? (
                        <Button size="sm" variant="outline" onClick={() => handleClaim(r)}>
                          <UserCheck className="w-3 h-3 mr-1" /> Assumir
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setSelectedRenewal(r)}>
                          <FileText className="w-3 h-3 mr-1" /> Analisar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        )}

        {/* Review dialog */}
        <Dialog open={!!selectedRenewal} onOpenChange={() => setSelectedRenewal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Analisar Renovação</DialogTitle></DialogHeader>
            {selectedRenewal && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                  <h4 className="font-semibold">Questionário de Saúde</h4>
                  {Object.entries(selectedRenewal.health_questionnaire || {}).map(([k, v]) => (
                    <div key={k}><span className="font-medium capitalize">{k.replace(/_/g, " ")}:</span> {String(v) || "N/A"}</div>
                  ))}
                </div>
                {selectedRenewal.original_prescription_url && (
                  <Button variant="outline" className="w-full" onClick={() => viewPrescription(selectedRenewal.original_prescription_url!)}>
                    <Eye className="w-4 h-4 mr-2" /> Ver Receita Original
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove} disabled={processing}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={processing}>
                    <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                  </Button>
                </div>
                <Textarea placeholder="Motivo da rejeição (opcional)" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default RenewalQueue;
