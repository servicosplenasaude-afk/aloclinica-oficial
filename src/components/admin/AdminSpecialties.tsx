import { useState, useEffect } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { getAdminNav } from "./adminNav";
import { AdminPageHeader } from "./AdminPageHeader";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import type { SpecialtyRow } from "@/types/domain";
// UI: accessible confirm dialog (replaces silent delete)
import { useConfirm } from "@/components/ui/confirm-dialog";

const AdminSpecialties = () => {
  const [specialties, setSpecialties] = useState<SpecialtyRow[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriceMin, setNewPriceMin] = useState("");
  const [newPriceMax, setNewPriceMax] = useState("");
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();

  useEffect(() => { fetchSpecialties(); }, []);

  const fetchSpecialties = async () => {
    const { data } = await db.from("specialties").select("*").order("name");
    setSpecialties((data as SpecialtyRow[] | null) ?? []);
    setLoading(false);
  };

  const addSpecialty = async () => {
    if (!newName.trim()) return;
    const min = newPriceMin ? Number(newPriceMin) : null;
    const max = newPriceMax ? Number(newPriceMax) : null;
    if (min !== null && max !== null && min > max) {
      toast.error("O valor mínimo não pode ser maior que o máximo");
      return;
    }
    const slug = newName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    const { error } = await db.from("specialties").insert({
      name: newName.trim(),
      slug,
      description: newDesc.trim() || null,
      price_min: min,
      price_max: max,
      consultation_price: min, // default to min
    } as any);
    if (error) toast.error("Erro", { description: error.message });
    else {
      setNewName(""); setNewDesc(""); setNewPriceMin(""); setNewPriceMax("");
      fetchSpecialties();
      toast.success("Especialidade adicionada!");
    }
  };

  const removeSpecialty = async (id: string, name: string) => {
    // UI: confirm destructive delete with accessible dialog
    const ok = await confirm({
      title: "Excluir especialidade?",
      description: `"${name}" será removida. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await db.from("specialties").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir", { description: error.message }); return; }
    fetchSpecialties();
  };

  const updateField = async (id: string, field: string, value: string) => {
    const numValue = value ? Number(value) : null;
    const { error } = await db.from("specialties").update({ [field]: numValue } as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar", { description: error.message }); return; }
    fetchSpecialties();
    toast.success("Atualizado!");
  };

  return (
    <DashboardLayout title="Administração" nav={getAdminNav("specialties")}>
      <div className="w-full mx-auto max-w-5xl space-y-5 pb-24 md:pb-6">
        <AdminPageHeader
          icon={ShieldCheck}
          eyebrow="Conteúdo"
          title="Especialidades"
          description="Gerencie as especialidades médicas e a faixa de preço de cada uma."
          accent="from-cyan-500 to-blue-600"
        />

        <Card className="border-border mb-6">
          <CardHeader><CardTitle className="text-base">Adicionar Especialidade</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <Label className="text-xs text-muted-foreground">Nome *</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Cardiologia" className="h-11 mt-1" onKeyDown={e => e.key === "Enter" && addSpecialty()} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descrição (opcional)" className="h-11 mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Preço Mínimo (R$)</Label>
                <Input value={newPriceMin} onChange={e => setNewPriceMin(e.target.value)} placeholder="Ex: 80" className="h-11 mt-1" type="number" min={0} step={1} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Preço Máximo (R$)</Label>
                <Input value={newPriceMax} onChange={e => setNewPriceMax(e.target.value)} placeholder="Ex: 250" className="h-11 mt-1" type="number" min={0} step={1} />
              </div>
              <Button onClick={addSpecialty} className="bg-gradient-hero text-primary-foreground h-11">
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Nome</TableHead>
                <TableHead scope="col">Descrição</TableHead>
                <TableHead scope="col" className="text-center">Mín (R$)</TableHead>
                <TableHead scope="col" className="text-center">Máx (R$)</TableHead>
                <TableHead scope="col" className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="shimmer-v2 h-4 rounded" /></TableCell>
                    <TableCell><div className="shimmer-v2 h-4 rounded" /></TableCell>
                    <TableCell><div className="shimmer-v2 h-4 rounded" /></TableCell>
                    <TableCell><div className="shimmer-v2 h-4 rounded" /></TableCell>
                    <TableCell><div className="shimmer-v2 h-4 rounded" /></TableCell>
                  </TableRow>
                ))
              ) : specialties.length === 0 ? (
                <TableRow>
                  {/* UI: empty state when no specialties exist */}
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    Nenhuma especialidade cadastrada ainda.
                  </TableCell>
                </TableRow>
              ) : specialties.map(s => (
                <TableRow key={s.id}>
                  <TableCell data-label="Nome" className="font-medium text-foreground">{s.name}</TableCell>
                  <TableCell data-label="Descrição" className="text-muted-foreground">{s.description || "—"}</TableCell>
                  <TableCell data-label="Mín">
                    <Input
                      type="number" min={0} step={1} className="w-24 mx-auto"
                      defaultValue={s.price_min ?? ""}
                      placeholder="—"
                      onBlur={e => updateField(s.id, "price_min", e.target.value)}
                    />
                  </TableCell>
                  <TableCell data-label="Máx">
                    <Input
                      type="number" min={0} step={1} className="w-24 mx-auto"
                      defaultValue={s.price_max ?? ""}
                      placeholder="—"
                      onBlur={e => updateField(s.id, "price_max", e.target.value)}
                    />
                  </TableCell>
                  <TableCell data-label="" className="text-right">
                    <Button size="sm" variant="ghost" aria-label={`Excluir ${s.name}`} onClick={() => removeSpecialty(s.id, s.name)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminSpecialties;
