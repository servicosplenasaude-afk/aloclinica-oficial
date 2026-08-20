/**
 * MediaLibrary — biblioteca de mídia integrada ao Studio.
 * Lê/upload bucket Storage `site-media`, registra em `site_media`,
 * obriga alt text para acessibilidade.
 */
import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { db } from "@/integrations/supabase/untyped";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Copy, Trash2, ImageIcon, Search } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Media = {
  id: string;
  url: string;
  path: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  alt_text: string | null;
  created_at: string;
};

export function MediaLibrary({
  open, onOpenChange, onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick?: (url: string, alt: string) => void;
}) {
  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const reload = async () => {
    setLoading(true);
    const { data, error } = await (db as any)
      .from("site_media").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Media[]);
    setLoading(false);
  };

  useEffect(() => { if (open) reload(); }, [open]);

  const upload = async (file: File) => {
    const altText = window.prompt(`Texto alternativo (acessibilidade) para "${file.name}":`)?.trim();
    if (!altText) { toast.error("Alt text é obrigatório"); return; }
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("site-media").upload(path, file, {
        cacheControl: "31536000", upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("site-media").getPublicUrl(path);
      const { error: insErr } = await (db as any).from("site_media").insert({
        url: pub.publicUrl, path, name: file.name,
        mime_type: file.type, size_bytes: file.size, alt_text: altText,
      });
      if (insErr) throw insErr;
      toast.success("Upload concluído");
      await reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setUploading(false); }
  };

  const remove = async (m: Media) => {
    const ok = await confirm({
      title: "Excluir imagem?",
      description: `“${m.name}” será removida da biblioteca e poderá deixar páginas que a utilizam sem imagem.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    try {
      const { error: storageError } = await supabase.storage.from("site-media").remove([m.path]);
      if (storageError) throw storageError;
      const { error } = await (db as any).from("site_media").delete().eq("id", m.id);
      if (error) throw error;
      setItems((prev) => prev.filter((x) => x.id !== m.id));
      toast.success("Removido");
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = items.filter((m) =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.alt_text ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[640px] sm:max-w-[640px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Biblioteca de Mídia</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="pl-7 h-8 text-xs" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="w-3.5 h-3.5 mr-1" />{uploading ? "Enviando…" : "Upload"}
            </Button>
          </div>
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          <div className="grid grid-cols-3 gap-3">
            {filtered.map((m) => (
              <div key={m.id} className="group relative rounded-lg border bg-card overflow-hidden">
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                  {m.mime_type?.startsWith("image/") ? (
                    <img src={m.url} alt={m.alt_text ?? m.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <div className="text-[10px] font-mono truncate" title={m.name}>{m.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate" title={m.alt_text ?? ""}>{m.alt_text}</div>
                  <div className="flex gap-1 pt-1">
                    {onPick && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1"
                        onClick={() => { onPick(m.url, m.alt_text ?? ""); onOpenChange(false); }}>
                        Usar
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={() => { navigator.clipboard.writeText(m.url); toast.success("URL copiada"); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove(m)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mídia ainda. Faça upload para começar.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
