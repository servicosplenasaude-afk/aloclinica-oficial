/**
 * ThemeEditor — edita o tema ativo (site_themes.is_active=true).
 * Atualiza tokens HSL, fontes, logo, favicon e og_image.
 * Preview ao vivo via CSS variables no documento.
 */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { db } from "@/integrations/supabase/untyped";
import { toast } from "sonner";
import { Save, Palette } from "lucide-react";

type Theme = {
  id: string;
  name: string;
  tokens: Record<string, string>;
  logo_url: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
};

const TOKEN_DEFS: { key: string; label: string; cssVar: string; isHsl?: boolean }[] = [
  { key: "primary",       label: "Primary (HSL)",     cssVar: "--primary",       isHsl: true },
  { key: "secondary",     label: "Secondary (HSL)",   cssVar: "--secondary",     isHsl: true },
  { key: "accent",        label: "Accent (HSL)",      cssVar: "--accent",        isHsl: true },
  { key: "background",    label: "Background (HSL)",  cssVar: "--background",    isHsl: true },
  { key: "foreground",    label: "Foreground (HSL)",  cssVar: "--foreground",    isHsl: true },
  { key: "radius",        label: "Radius (rem)",      cssVar: "--radius" },
  { key: "font_heading",  label: "Font Heading",      cssVar: "--font-heading" },
  { key: "font_body",     label: "Font Body",         cssVar: "--font-family" },
];

function applyPreview(tokens: Record<string, string>) {
  const root = document.documentElement;
  for (const def of TOKEN_DEFS) {
    if (tokens[def.key]) root.style.setProperty(def.cssVar, tokens[def.key]);
  }
}

export function ThemeEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (db as any).from("site_themes").select("*").eq("is_active", true).maybeSingle()
      .then(({ data, error }: any) => {
        if (error) { toast.error(error.message); return; }
        setTheme(data);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const updateToken = (k: string, v: string) => {
    if (!theme) return;
    const tokens = { ...theme.tokens, [k]: v };
    setTheme({ ...theme, tokens });
    applyPreview(tokens);
  };

  const save = async () => {
    if (!theme) return;
    setSaving(true);
    try {
      const { error } = await (db as any).from("site_themes").update({
        tokens: theme.tokens,
        logo_url: theme.logo_url,
        favicon_url: theme.favicon_url,
        og_image_url: theme.og_image_url,
      }).eq("id", theme.id);
      if (error) throw error;

      // Propaga para o SITE PÚBLICO: o ThemeApplier lê app_settings.theme via
      // get_active_theme(). Mapeia font_body→font_family e faz MERGE (preserva
      // tokens não editados aqui, ex.: muted/border/destructive).
      const t = theme.tokens ?? {};
      const publicTokens: Record<string, string> = {
        primary: t.primary, secondary: t.secondary, accent: t.accent,
        background: t.background, foreground: t.foreground,
        radius: t.radius, font_heading: t.font_heading, font_family: t.font_body,
      };
      const clean = Object.fromEntries(Object.entries(publicTokens).filter(([, v]) => v != null && v !== ""));
      try {
        const { data: existing } = await (db as any).from("app_settings").select("value").eq("key", "theme").maybeSingle();
        const merged = { ...(existing?.value ?? {}), ...clean };
        await (db as any).from("app_settings").upsert({ key: "theme", value: merged }, { onConflict: "key" });
      } catch (e) { /* se falhar, o tema do editor ainda ficou salvo em site_themes */ }

      try { sessionStorage.removeItem("aloc_theme_v1"); } catch {}
      toast.success("Tema salvo e aplicado ao site");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Palette className="w-4 h-4" /> Editor de Tema</SheetTitle>
        </SheetHeader>
        {loading && <p className="text-sm text-muted-foreground py-6">Carregando…</p>}
        {theme && (
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs">Nome do tema</Label>
              <Input value={theme.name} onChange={(e) => setTheme({ ...theme, name: e.target.value })} className="h-8" />
            </div>
            <Separator />
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Tokens visuais</p>
            {TOKEN_DEFS.map((def) => (
              <div key={def.key} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <div>
                  <Label className="text-xs">{def.label}</Label>
                  <Input
                    value={theme.tokens?.[def.key] ?? ""}
                    placeholder={def.isHsl ? "215 75% 32%" : ""}
                    onChange={(e) => updateToken(def.key, e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
                {def.isHsl && theme.tokens?.[def.key] && (
                  <div className="w-8 h-8 rounded border mt-4" style={{ background: `hsl(${theme.tokens[def.key]})` }} />
                )}
              </div>
            ))}
            <Separator />
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Branding</p>
            <div>
              <Label className="text-xs">Logo URL</Label>
              <Input value={theme.logo_url ?? ""} onChange={(e) => setTheme({ ...theme, logo_url: e.target.value })} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">Favicon URL</Label>
              <Input value={theme.favicon_url ?? ""} onChange={(e) => setTheme({ ...theme, favicon_url: e.target.value })} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">OG Image URL</Label>
              <Input value={theme.og_image_url ?? ""} onChange={(e) => setTheme({ ...theme, og_image_url: e.target.value })} className="h-8" />
            </div>
            <div className="pt-4 flex gap-2">
              <Button onClick={save} disabled={saving} className="flex-1">
                <Save className="w-4 h-4 mr-1" />{saving ? "Salvando…" : "Salvar tema"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}