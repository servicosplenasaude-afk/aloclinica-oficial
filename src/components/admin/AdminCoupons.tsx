import { useState, useEffect } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getAdminNav } from "./adminNav";
import { AdminPageHeader } from "./AdminPageHeader";
// ... keep existing code
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Tag, Copy, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CouponRow } from "@/types/domain";
// UI: accessible confirm dialog for destructive delete
import { useConfirm } from "@/components/ui/confirm-dialog";

const AdminCoupons = () => {
  
  const nav = getAdminNav("coupons");
  const confirm = useConfirm();
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    discount_value: "10",
    max_uses: "",
    valid_until: "",
  });

  useEffect(() => { fetchCoupons(); }, []);

  const fetchCoupons = async () => {
    const { data } = await db.from("coupons").select("*").order("created_at", { ascending: false });
    setCoupons(data ?? []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.code.trim()) {
      toast.error("Código é obrigatório");
      return;
    }

    const { error } = await db.from("coupons").insert({
      code: form.code.toUpperCase().trim(),
      discount_value: Number(form.discount_value),
      discount_type: "percent",
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      valid_until: form.valid_until || null,
      is_active: true,
    });

    if (error) {
      toast.error("Erro ao criar cupom", { description: error.message });
    } else {
      toast.success("Cupom criado com sucesso!");
      setShowForm(false);
      setForm({ code: "", discount_value: "10", max_uses: "", valid_until: "" });
      fetchCoupons();
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await db.from("coupons").update({ is_active: !currentActive }).eq("id", id);
    fetchCoupons();
  };

  const deleteCoupon = async (id: string) => {
    // UI: confirm before destructive delete
    const ok = await confirm({
      title: "Excluir cupom?",
      description: "O cupom deixará de ser válido imediatamente. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    await db.from("coupons").delete().eq("id", id);
    toast.success("Cupom excluído");
    fetchCoupons();
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "ALLO";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setForm(f => ({ ...f, code }));
  };

  return (
    <DashboardLayout title="Cupons de Desconto" nav={nav} role="admin">
      <div className="space-y-5 pb-24 md:pb-8">
        <AdminPageHeader
          icon={Tag}
          eyebrow="Conteúdo"
          title="Cupons"
          description="Gerencie códigos promocionais e descontos para usuários."
          accent="from-orange-500 to-amber-600"
          badge={{ label: `${coupons.length} ${coupons.length === 1 ? "cupom" : "cupons"}`, tone: "warning" }}
          actions={
            <Button onClick={() => setShowForm(true)} size="sm" className="rounded-xl">
              <Plus className="w-4 h-4 mr-1.5" /> Novo Cupom
            </Button>
          }
        />

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto -mx-0.5 rounded-xl">

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Código</TableHead>
                  <TableHead scope="col">Desconto</TableHead>
                  <TableHead scope="col">Usos</TableHead>
                  <TableHead scope="col">Expira em</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground"><span className="text-muted-foreground text-sm">Carregando...</span></TableCell></TableRow>
                ) : coupons.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cupom cadastrado</TableCell></TableRow>
                ) : coupons.map(c => (
                  <TableRow key={c.id}>
                    <TableCell data-label="Código">
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono font-bold">{c.code}</code>
                        <button onClick={() => copyCode(c.code, c.id)} className="text-muted-foreground hover:text-foreground">
                          {copiedId === c.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell data-label="Desconto"><Badge variant="secondary">{c.discount_type === "fixed" ? `R$ ${c.discount_value}` : `${c.discount_value}%`}</Badge></TableCell>
                    <TableCell data-label="Usos">{c.current_uses ?? 0}{c.max_uses ? ` / ${c.max_uses}` : " / ∞"}</TableCell>
                    <TableCell data-label="Expira">{c.valid_until ? format(new Date(c.valid_until), "dd/MM/yyyy", { locale: ptBR }) : "Sem expiração"}</TableCell>
                    <TableCell data-label="Ativo">
                      <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)} />
                    </TableCell>
                    <TableCell data-label="">
                      <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => deleteCoupon(c.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cupom de Desconto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Código do Cupom</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="ALLO10OFF" className="font-mono" />
                  <Button variant="outline" onClick={generateCode} size="sm">Gerar</Button>
                </div>
              </div>
              <div>
                <Label>Desconto (%)</Label>
                <Input type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} min={1} max={100} className="mt-1" />
              </div>
              <div>
                <Label>Limite de usos (vazio = ilimitado)</Label>
                <Input type="number" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} min={1} className="mt-1" />
              </div>
              <div>
                <Label>Data de expiração (opcional)</Label>
                <Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleCreate}><Tag className="w-4 h-4 mr-2" /> Criar Cupom</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminCoupons;
