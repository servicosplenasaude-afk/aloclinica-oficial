/**
 * AdminStudio — editor unificado de site (Wave 3 do Studio).
 *
 * Layout em 3 colunas:
 *   [ Sidebar de blocos ] [ Editor de campos ] [ Preview ao vivo ]
 *
 * Recursos:
 *  • Rascunho ↔ publicado (com RPC publish_site_block)
 *  • Histórico de versões + rollback 1-clique
 *  • Multi-idioma (pt-BR / en / es) por bloco
 *  • Viewport mobile/tablet/desktop no preview
 *  • Auditoria automática via trigger de banco
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getAdminNav } from "@/components/admin/adminNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Save, Send, Undo2, History, Monitor, Tablet, Smartphone, RefreshCw,
  Search, Globe, FileText, Settings as SettingsIcon, Palette, Eye, EyeOff,
  ClipboardList,
} from "lucide-react";
import {
  useBlocks, saveBlockDraft, discardDraft, publishBlock, toggleBlock, invalidateBlocksCache,
  type SiteBlock, type BlockScope,
} from "@/lib/site-blocks";
import { BlockFieldsForm } from "@/components/admin/studio/BlockFieldsForm";
import { VersionHistoryDrawer } from "@/components/admin/studio/VersionHistoryDrawer";
import { AuditTrailDrawer } from "@/components/admin/studio/AuditTrailDrawer";
import { ThemeEditor } from "@/components/admin/studio/ThemeEditor";
import { MediaLibrary } from "@/components/admin/studio/MediaLibrary";
import { invalidateSiteSections } from "@/lib/site-sections";
import { invalidateSiteConfig } from "@/lib/site-config";
import { supabase } from "@/integrations/supabase/client";

const VIEWPORTS = {
  desktop: { w: "100%", h: "100%", label: "Desktop", icon: Monitor },
  tablet:  { w: "768px", h: "100%", label: "Tablet",  icon: Tablet },
  mobile:  { w: "390px", h: "100%", label: "Mobile",  icon: Smartphone },
} as const;

const LOCALES = [
  { code: "pt-BR", label: "🇧🇷 PT" },
  { code: "en",    label: "🇺🇸 EN" },
  { code: "es",    label: "🇪🇸 ES" },
] as const;

const SCOPE_META: Record<BlockScope, { label: string; icon: any }> = {
  section: { label: "Seções",       icon: FileText },
  page:    { label: "Páginas",      icon: Globe },
  config:  { label: "Configurações", icon: SettingsIcon },
  theme:   { label: "Tema",         icon: Palette },
  email:   { label: "Emails",       icon: FileText },
};

export default function AdminStudio() {
  const [params, setParams] = useSearchParams();
  const nav = useMemo(() => getAdminNav("studio"), []);
  const { blocks, loading, reload, setBlocks } = useBlocks();

  const [scope, setScope] = useState<BlockScope>("section");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewport, setViewport] = useState<keyof typeof VIEWPORTS>("desktop");
  const [locale, setLocale] = useState<string>("pt-BR");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewSrc, setPreviewSrc] = useState("/");
  const [liveSync, setLiveSync] = useState(true);
  const [lastRemoteAt, setLastRemoteAt] = useState<number | null>(null);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  // Working copy do draft (estado local para edição fluida)
  const [draft, setDraft] = useState<Record<string, any>>({});
  useEffect(() => {
    if (!selected) return;
    if (locale === "pt-BR") {
      setDraft(selected.draft ?? selected.published ?? {});
    } else {
      const i18nDraft = (selected.i18n?.[locale] ?? {}) as Record<string, any>;
      setDraft(i18nDraft);
    }
  }, [selected?.id, locale]);

  const filtered = useMemo(() => {
    return blocks
      .filter((b) => b.scope === scope)
      .filter((b) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return b.display_name.toLowerCase().includes(q) || b.block_key.toLowerCase().includes(q);
      });
  }, [blocks, scope, search]);

  // Auto-select primeiro bloco quando trocar de scope
  useEffect(() => {
    if (!selected || selected.scope !== scope) {
      const first = filtered[0];
      if (first) setSelectedId(first.id);
    }
  }, [scope, filtered, selected]);

  // Pega rota a previewar conforme o bloco
  useEffect(() => {
    if (!selected) return;
    if (selected.scope === "section" && selected.page_slug === "home") setPreviewSrc("/");
    else if (selected.scope === "page" && selected.page_slug) setPreviewSrc(`/${selected.page_slug}`);
    else setPreviewSrc("/");
  }, [selected?.id]);

  const dirty = useMemo(() => {
    if (!selected) return false;
    const current = locale === "pt-BR"
      ? (selected.draft ?? selected.published ?? {})
      : (selected.i18n?.[locale] ?? {});
    return JSON.stringify(current) !== JSON.stringify(draft);
  }, [draft, selected, locale]);

  const handleSaveDraft = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      if (locale === "pt-BR") {
        await saveBlockDraft(selected.id, draft);
      } else {
        // i18n: atualiza apenas a chave do locale
        const newI18n = { ...(selected.i18n ?? {}), [locale]: draft };
        const { db } = await import("@/integrations/supabase/untyped");
        const { error } = await (db as any).from("site_blocks").update({ i18n: newI18n, has_draft: true, draft: selected.draft ?? selected.published }).eq("id", selected.id);
        if (error) throw error;
      }
      toast.success("Rascunho salvo");
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selected) return;
    setPublishing(true);
    try {
      // Garante draft salvo antes de publicar
      if (dirty) await saveBlockDraft(selected.id, locale === "pt-BR" ? draft : (selected.draft ?? selected.published ?? {}));
      await publishBlock(selected.id, `Publicado via Studio (${locale})`);
      invalidateSiteSections();
      invalidateSiteConfig();
      toast.success("Bloco publicado");
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao publicar");
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscard = async () => {
    if (!selected) return;
    try {
      await discardDraft(selected.id);
      toast.success("Rascunho descartado");
      await reload();
      setDraft(selected.published ?? {});
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  const handleToggle = async (b: SiteBlock, enabled: boolean) => {
    try {
      await toggleBlock(b.id, enabled);
      setBlocks((prev) => prev.map((x) => x.id === b.id ? { ...x, is_enabled: enabled } : x));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Atalhos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty) handleSaveDraft(); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") { e.preventDefault(); handlePublish(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, draft, selected]);

  // ── Wave 8: Realtime sync com outros editores + push pro iframe de preview ──
  useEffect(() => {
    if (!liveSync) return;
    const channel = supabase
      .channel("studio-site-blocks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_blocks" },
        (payload: any) => {
          setLastRemoteAt(Date.now());
          // Se o bloco selecionado mudou em outro editor, só recarrega se não tiver dirty
          if (selected && payload.new?.id === selected.id && dirty) {
            toast.info("Bloco alterado em outro editor — salve seu rascunho antes de recarregar");
            return;
          }
          invalidateBlocksCache();
          invalidateSiteSections();
          invalidateSiteConfig();
          reload();
          // Atualiza o iframe de preview
          const f = document.getElementById("studio-preview-iframe") as HTMLIFrameElement | null;
          if (f) f.contentWindow?.postMessage({ type: "studio:block-updated", blockId: payload.new?.id }, "*");
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [liveSync, selected?.id, dirty, reload]);

  // Debounced live preview: a cada keystroke do draft, sinaliza o iframe pra rerender (sem persistir)
  useEffect(() => {
    if (!selected) return;
    const handle = window.setTimeout(() => {
      const f = document.getElementById("studio-preview-iframe") as HTMLIFrameElement | null;
      if (f) f.contentWindow?.postMessage(
        { type: "studio:live-preview", blockId: selected.id, pageSlug: selected.page_slug, blockKey: selected.block_key, draft, locale },
        "*",
      );
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draft, selected?.id, locale]);

  return (
    <DashboardLayout title="Studio" nav={nav} role="admin">
      <div className="h-[calc(100vh-180px)] flex gap-3 min-h-[600px]">

        {/* ── Sidebar ── */}
        <aside className="w-[280px] flex flex-col rounded-xl border bg-card overflow-hidden">
          <div className="p-3 border-b space-y-2">
            <Tabs value={scope} onValueChange={(v) => setScope(v as BlockScope)}>
              <TabsList className="grid grid-cols-4 h-8 w-full">
                <TabsTrigger value="section" className="text-[11px] px-1">Seções</TabsTrigger>
                <TabsTrigger value="page" className="text-[11px] px-1">Páginas</TabsTrigger>
                <TabsTrigger value="config" className="text-[11px] px-1">Config</TabsTrigger>
                <TabsTrigger value="theme" className="text-[11px] px-1">Tema</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-7 h-8 text-xs" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading && <p className="text-xs text-muted-foreground p-3">Carregando…</p>}
            {!loading && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground p-3 text-center">Nenhum bloco {SCOPE_META[scope].label.toLowerCase()}.</p>
            )}
            {filtered.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`w-full text-left rounded-lg px-3 py-2 transition group ${
                  selectedId === b.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/60 border border-transparent"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{b.display_name}</div>
                    <div className="text-[10px] text-muted-foreground truncate font-mono">{b.page_slug ? `${b.page_slug}/` : ""}{b.block_key}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {b.has_draft && <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">draft</Badge>}
                    {!b.is_enabled && <EyeOff className="w-3 h-3 text-muted-foreground" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Editor ── */}
        <section className="w-[420px] flex flex-col rounded-xl border bg-card overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione um bloco
            </div>
          ) : (
            <>
              <div className="p-3 border-b space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{selected.display_name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">{selected.block_key}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch checked={selected.is_enabled} onCheckedChange={(v) => handleToggle(selected, v)} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={locale} onValueChange={setLocale}>
                    <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCALES.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setHistoryOpen(true)}>
                    <History className="w-3.5 h-3.5 mr-1" />Versões
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMediaOpen(true)}>
                    <FileText className="w-3.5 h-3.5 mr-1" />Mídia
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setThemeOpen(true)}>
                    <Palette className="w-3.5 h-3.5 mr-1" />Tema
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setAuditOpen(true)}>
                    <ClipboardList className="w-3.5 h-3.5 mr-1" />Auditoria
                  </Button>
                  <div className="ml-auto flex items-center gap-1">
                    {dirty && <span className="text-[10px] text-amber-600">não salvo</span>}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <BlockFieldsForm
                  fields={selected.schema?.fields ?? []}
                  value={draft}
                  onChange={setDraft}
                />
              </div>
              <div className="p-3 border-t bg-muted/30 flex gap-2">
                {selected.has_draft && (
                  <Button variant="ghost" size="sm" onClick={handleDiscard} className="text-xs">
                    <Undo2 className="w-3.5 h-3.5 mr-1" />Descartar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={!dirty || saving} className="text-xs ml-auto">
                  <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Salvando…" : "Salvar rascunho"}
                </Button>
                <Button size="sm" onClick={handlePublish} disabled={publishing || (!selected.has_draft && !dirty)} className="text-xs">
                  <Send className="w-3.5 h-3.5 mr-1" />{publishing ? "Publicando…" : "Publicar"}
                </Button>
              </div>
            </>
          )}
        </section>

        {/* ── Preview ── */}
        <section className="flex-1 rounded-xl border bg-muted/20 overflow-hidden flex flex-col min-w-0">
          <div className="p-2 border-b bg-card flex items-center gap-2">
            <div className="flex gap-1">
              {(Object.keys(VIEWPORTS) as Array<keyof typeof VIEWPORTS>).map((k) => {
                const V = VIEWPORTS[k]; const Icon = V.icon;
                return (
                  <Button key={k} variant={viewport === k ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewport(k)} title={V.label}>
                    <Icon className="w-3.5 h-3.5" />
                  </Button>
                );
              })}
            </div>
            <Input value={previewSrc} onChange={(e) => setPreviewSrc(e.target.value)} className="h-7 text-xs flex-1" />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
              const f = document.getElementById("studio-preview-iframe") as HTMLIFrameElement | null;
              if (f) f.setAttribute("src", f.getAttribute("src") ?? f.src);
            }}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex-1 flex items-start justify-center overflow-auto p-4">
            <div style={{ width: VIEWPORTS[viewport].w, height: "100%", maxWidth: "100%" }} className="bg-background rounded-lg shadow-lg border overflow-hidden transition-all">
              <iframe
                id="studio-preview-iframe"
                src={previewSrc}
                className="w-full h-full min-h-[700px]"
                title="Preview"
              />
            </div>
          </div>
        </section>
      </div>

      <VersionHistoryDrawer
        blockId={selected?.id ?? null}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRolledBack={() => { reload(); invalidateSiteSections(); invalidateSiteConfig(); }}
      />
      <ThemeEditor open={themeOpen} onOpenChange={setThemeOpen} />
      <MediaLibrary open={mediaOpen} onOpenChange={setMediaOpen} />
      <AuditTrailDrawer open={auditOpen} onOpenChange={setAuditOpen} blockId={selected?.id ?? null} />
    </DashboardLayout>
  );
}
