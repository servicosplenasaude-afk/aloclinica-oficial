import { useState, useEffect } from "react";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getDoctorNav } from "./doctorNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface PatientDoc {
  id: string;
  patient_id: string;
  file_name: string;
  file_url: string | null;
  file_type: string | null;
  description: string | null;
  created_at: string;
  patient_name: string;
}

interface PatientProfile {
  user_id: string;
  first_name: string;
  last_name: string;
}

const PatientDocuments = () => {
  const { user } = useAuth();
  
  const [documents, setDocuments] = useState<PatientDoc[]>([]);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPatient, setFilterPatient] = useState("all");

  useEffect(() => { if (user) fetchDocuments(); }, [user]);

  const fetchDocuments = async () => {
    const { data: doc } = await db.from("doctor_profiles").select("id").eq("user_id", user!.id).single();
    if (!doc) { setLoading(false); return; }

    // Get all patients this doctor has appointments with
    const { data: appts } = await db.from("appointments")
      .select("patient_id")
      .eq("doctor_id", doc.id);

    const patientIds = [...new Set((appts ?? []).filter(a => a.patient_id).map(a => a.patient_id))];
    if (patientIds.length === 0) { setLoading(false); return; }

    // Get patient profiles
    const { data: profiles } = await db.from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", patientIds.filter((id): id is string => !!id));
    
    setPatients(profiles ?? []);

    // Get documents for these patients
    const { data: docs } = await db.from("patient_documents")
      .select("*")
      .in("patient_id", patientIds.filter((id): id is string => !!id))
      .order("created_at", { ascending: false });

    if (docs) {
      const pMap = new Map((profiles ?? []).map(p => [p.user_id, `${p.first_name} ${p.last_name}`]));
      setDocuments(docs.map(d => ({
        ...d,
        patient_name: pMap.get(d.patient_id) ?? "Paciente",
      })));
    }
    setLoading(false);
  };

  const viewDocument = async (doc: PatientDoc) => {
    // Usa o caminho REAL salvo em file_url (ex.: "<uid>/1712-arquivo.pdf").
    // Antes reconstruía "<patient_id>/<file_name>" — caminho inexistente (o
    // upload prefixa com Date.now()) → link morto / "Erro ao abrir".
    const path = doc.file_url || `${doc.patient_id}/${doc.file_name}`;
    const { data } = await db.storage.from("patient-documents").createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao abrir documento");
    }
  };

  const filtered = documents.filter(d => {
    const matchSearch = d.file_name.toLowerCase().includes(search.toLowerCase()) ||
      d.patient_name.toLowerCase().includes(search.toLowerCase());
    const matchPatient = filterPatient === "all" || d.patient_id === filterPatient;
    return matchSearch && matchPatient;
  });

  const fileIcon = (type: string) => {
    if (type?.includes("image")) return "🖼️";
    if (type?.includes("pdf")) return "📄";
    return "📎";
  };

  return (
    <DashboardLayout title="Médico" nav={getDoctorNav("documents")}>
      <div className="w-full mx-auto max-w-5xl pb-24 md:pb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Exames e Documentos</h1>
        <p className="text-muted-foreground text-sm mb-4">Documentos enviados pelos pacientes</p>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            {/* UI: aria-label gives the search field an accessible name (only placeholder before) */}
            <Input aria-label="Buscar documentos" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterPatient} onValueChange={setFilterPatient}>
            {/* UI: aria-label names the patient filter for screen readers */}
            <SelectTrigger aria-label="Filtrar por paciente" className="w-48"><SelectValue placeholder="Todos pacientes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos pacientes</SelectItem>
              {patients.map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? <div className="shimmer-v2 h-5 rounded w-32 inline-block" aria-label="Carregando" /> : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto -mx-0.5 rounded-xl">

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(d => (
                  <TableRow key={d.id}>
                    <TableCell data-label="Documento">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{fileIcon(d.file_type ?? "")}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{d.description || d.file_name}</p>
                          <p className="text-xs text-muted-foreground">{d.file_name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-label="Paciente" className="text-muted-foreground">{d.patient_name}</TableCell>
                    <TableCell data-label="Data" className="text-muted-foreground text-sm">
                      {format(new Date(d.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell data-label="Tipo" className="text-muted-foreground text-sm">{d.file_type?.split("/")[1] ?? "—"}</TableCell>
                    <TableCell data-label="">
                      {/* UI: aria-label disambiguates repeated "Ver" buttons per row */}
                      <Button size="sm" variant="outline" aria-label={`Ver documento ${d.description || d.file_name}`} onClick={() => viewDocument(d)}>
                        <Eye className="w-3 h-3 mr-1" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      <FileText className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                      Nenhum documento encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientDocuments;
