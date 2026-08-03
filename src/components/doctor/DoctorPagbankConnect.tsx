// Conectar conta PagBank do médico (para o repasse via split de pagamento).
// O médico informa o Account ID da conta PagBank dele; salvamos em
// doctor_profiles.pagbank_account_id. Sem isso, o split não repassa a ele.
// Componente autocontido — pode ser inserido em DoctorWallet/DoctorEarnings.
import { useEffect, useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Landmark, CheckCircle2, Loader2 } from "lucide-react";

export function DoctorPagbankConnect() {
  const { user } = useAuth();
  const [accountId, setAccountId] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await db
        .from("doctor_profiles").select("pagbank_account_id").eq("user_id", user.id).single();
      const val = (data as { pagbank_account_id?: string } | null)?.pagbank_account_id ?? null;
      setSaved(val);
      if (val) setAccountId(val);
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    const clean = accountId.trim();
    if (!clean.startsWith("ACCO_")) {
      toast.error("O Account ID do PagBank começa com \"ACCO_\". Confira e tente de novo.");
      return;
    }
    setSaving(true);
    const { error } = await db
      .from("doctor_profiles").update({ pagbank_account_id: clean }).eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar. Tente novamente."); return; }
    setSaved(clean);
    toast.success("Conta PagBank conectada! Seus repasses irão para ela.");
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Landmark className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">Conta PagBank para repasse</h3>
          <p className="text-xs text-muted-foreground">Onde você recebe o valor das suas consultas.</p>
        </div>
        {saved && <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto" />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pagbank-account" className="text-[13px] font-semibold">Account ID do PagBank</Label>
        <Input
          id="pagbank-account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="ACCO_XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
          className="font-mono text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          Encontre no seu painel PagBank (Conta → dados da conta / API). Começa com <code>ACCO_</code>.
        </p>
      </div>

      <Button onClick={save} disabled={saving || accountId.trim() === (saved ?? "")}>
        {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando…</> : saved ? "Atualizar conta" : "Conectar conta"}
      </Button>
    </div>
  );
}

export default DoctorPagbankConnect;
