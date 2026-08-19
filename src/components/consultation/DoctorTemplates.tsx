/**
 * Templates de texto do médico (snippets reutilizáveis em SOAP/receita).
 *
 * Hooks com lista + insert/delete. UI minimalista: dropdown de inserção +
 * "Salvar como template" abaixo de um campo. Usa doctor_text_templates.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Save, Bookmark, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/logger";

export type TemplateType =
  | "soap_subjective" | "soap_objective" | "soap_assessment" | "soap_plan"
  | "prescription" | "generic";

interface Template {
  id: string;
  type: TemplateType;
  title: string;
  body: string;
}

export function useDoctorTemplates(type?: TemplateType) {
  const { user } = useAuth();
  const userId = user?.id;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let q = db.from("doctor_text_templates").select("id, type, title, body").eq("doctor_user_id", userId);
      if (type) q = q.eq("type", type);
      const { data } = await q.order("created_at", { ascending: false }).limit(40);
      setTemplates((data ?? []) as Template[]);
    } catch (e) {
      logError("useDoctorTemplates load", e);
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (title: string, body: string, t: TemplateType) => {
    if (!userId) return;
    try {
      const { data, error } = await db.from("doctor_text_templates")
        .insert({ doctor_user_id: userId, title, body, type: t } as any)
        .select("id, type, title, body")
        .single();
      if (error) throw error;
      setTemplates((prev) => [data as Template, ...prev]);
      toast.success("Template salvo");
    } catch (e: any) {
      toast.error("Não foi possível salvar", { description: e?.message });
    }
  }, [userId]);

  const remove = useCallback(async (id: string) => {
    try {
      const { error } = await db.from("doctor_text_templates").delete().eq("id", id);
      if (error) throw error;
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      toast.error("Erro ao remover", { description: e?.message });
    }
  }, []);

  return { templates, loading, save, remove, reload: load };
}

/**
 * Inline controls: ao lado do campo, dropdown "Inserir template" + ação
 * "Salvar atual como template".
 */
export function TemplateControls({
  type,
  currentText,
  onInsert,
}: {
  type: TemplateType;
  currentText: string;
  onInsert: (text: string) => void;
}) {
  const { templates, loading, save, remove } = useDoctorTemplates(type);
  const [openSave, setOpenSave] = useState(false);
  const [openList, setOpenList] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => currentText.trim().length >= 4, [currentText]);

  const handleSave = async () => {
    if (!title.trim() || !canSave) return;
    setSaving(true);
    await save(title.trim(), currentText, type);
    setSaving(false);
    setTitle("");
    setOpenSave(false);
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={openList} onOpenChange={setOpenList}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 gap-1" type="button" disabled={loading && templates.length === 0}>
            <Bookmark className="w-3 h-3" /> Templates
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="end">
          {loading ? (
            <div className="py-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></div>
          ) : templates.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">Nenhum template salvo ainda. Use "Salvar" para criar o primeiro.</p>
          ) : (
            <ul className="max-h-72 overflow-auto space-y-1">
              {templates.map((t) => (
                <li key={t.id} className="group flex items-start gap-1 rounded-lg hover:bg-muted/50 p-2">
                  <button type="button" className="flex-1 text-left min-w-0" onClick={() => { onInsert(t.body); setOpenList(false); }}>
                    <p className="text-xs font-semibold text-foreground truncate">{t.title}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{t.body}</p>
                  </button>
                  <button type="button" onClick={() => remove(t.id)} aria-label="Remover template"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      <Popover open={openSave} onOpenChange={(o) => { if (!canSave) { toast.info("Escreva um texto antes de salvar."); return; } setOpenSave(o); }}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 gap-1" type="button">
            <Save className="w-3 h-3" /> Salvar
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-2" align="end">
          <p className="text-xs font-semibold text-foreground">Salvar como template</p>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome (ex.: IVAS leve)" autoFocus className="h-8 text-xs" />
          <Button size="sm" className="w-full h-8 text-xs gap-1.5" disabled={saving || !title.trim()} onClick={handleSave}>
            <Plus className="w-3 h-3" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
