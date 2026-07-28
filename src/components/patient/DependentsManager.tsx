import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getPatientNav } from "./patientNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CpfInput from "@/components/ui/cpf-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Edit2, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatMask } from "@/hooks/use-mask";

interface Dependent {
  id: string;
  name: string;
  relationship: string;
  cpf: string | null;
  date_of_birth: string | null;
  created_at: string;
}

const RELATIONSHIPS = [
  "Filho(a)", "Cônjuge", "Pai/Mãe", "Irmão(ã)", "Avô/Avó", "Neto(a)", "Sobrinho(a)", "Outro"
];

const DependentsManager = () => {
  const { user } = useAuth();
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Dependent | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [cpf, setCpf] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const cpfMasked = formatMask(cpf, "cpf");

  useEffect(() => { if (user) fetchDependents(); }, [user]);

  const fetchDependents = async () => {
    const { data } = await db.from("dependents")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true });
    setDependents(data ?? []);
    setLoading(false);
  };

  const resetForm = () => {
    setName(""); setRelationship(""); setCpf(""); setDateOfBirth("");
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (dep: Dependent) => {
    setEditing(dep);
    setName(dep.name);
    setRelationship(dep.relationship);
    setCpf(dep.cpf || "");
    setDateOfBirth(dep.date_of_birth || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !relationship) {
      toast.error("Preencha nome e parentesco");
      return;
    }
    setSaving(true);

    const payload = {
      name: name.trim(),
      relationship,
      cpf: cpf.replace(/\D/g, "") || null,
      date_of_birth: dateOfBirth || null,
    };

    if (editing) {
      const { error } = await db.from("dependents").update(payload).eq("id", editing.id);
      if (error) toast.error("Erro ao atualizar");
      else toast.success("Dependente atualizado!");
    } else {
      const { error } = await db.from("dependents").insert({ ...payload, user_id: user!.id });
      if (error) toast.error("Erro ao cadastrar");
      else toast.success("Dependente adicionado!");
    }

    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchDependents();
  };

  const handleDelete = async (id: string) => {
    const { error } = await db.from("dependents").delete().eq("id", id);
    if (error) toast.error("Erro ao remover");
    else { toast.success("Dependente removido"); fetchDependents(); }
  };

  const calcAge = (dob: string) => {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
  };

  const relationshipEmoji: Record<string, string> = {
    "Filho(a)": "👶", "Cônjuge": "💑", "Pai/Mãe": "👨‍👩", "Irmão(ã)": "🤝",
    "Avô/Avó": "👴", "Neto(a)": "👧", "Sobrinho(a)": "🧒", "Outro": "👤",
  };

  return (
    <DashboardLayout title="Paciente" nav={getPatientNav("dependents")}>
      <div className="w-full mx-auto max-w-3xl pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground tabular-nums">Dependentes</h1>
            <p className="text-sm text-muted-foreground">Cadastre familiares para agendar consultas para eles</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="bg-gradient-hero text-primary-foreground">
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar Dependente" : "Novo Dependente"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Nome completo *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do dependente" className="mt-1" />
                </div>
                <div>
                  <Label>Parentesco *</Label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CPF (opcional)</Label>
                    <CpfInput value={cpf} onChange={setCpf} optional className="mt-1" />
                  </div>
                  <div>
                    <Label>Data de nascimento</Label>
                    <Input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="mt-1" />
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : editing ? "Atualizar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[1, 2].map(i => <div key={i} className="h-24 shimmer-v2 rounded-xl" />)}
          </div>
        ) : dependents.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Nenhum dependente cadastrado</p>
              <p className="text-xs text-muted-foreground mb-4">Adicione filhos, cônjuge ou familiares para agendar consultas para eles</p>
              <Button onClick={openCreate} variant="outline" size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar dependente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {dependents.map(dep => (
              <Card key={dep.id} className="card-interactive border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
                        {relationshipEmoji[dep.relationship] || "👤"}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{dep.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] h-5">{dep.relationship}</Badge>
                          {dep.date_of_birth && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              {calcAge(dep.date_of_birth)} anos
                            </span>
                          )}
                          {dep.cpf && (
                            <span className="text-[10px] text-muted-foreground">
                              CPF: •••.•••.{dep.cpf.slice(-5, -2)}-{dep.cpf.slice(-2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(dep)} aria-label="Editar dependente">
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Remover dependente">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover dependente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover {dep.name}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(dep.id)} className="bg-destructive text-destructive-foreground">
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DependentsManager;
