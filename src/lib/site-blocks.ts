/**
 * Studio — leitura e mutação de site_blocks.
 * Unifica seções/configs/tema do site num único modelo versionado.
 */
import { useEffect, useState, useCallback } from "react";
import { db } from "@/integrations/supabase/untyped";
import { warn } from "@/lib/logger";

export type BlockScope = "section" | "page" | "config" | "theme" | "email";

export type SiteBlock = {
  id: string;
  scope: BlockScope;
  page_slug: string | null;
  block_key: string;
  display_name: string;
  display_order: number;
  is_enabled: boolean;
  schema: { fields?: BlockField[] } & Record<string, any>;
  published: Record<string, any>;
  draft: Record<string, any> | null;
  has_draft: boolean;
  i18n: Record<string, Record<string, any>>;
  last_published_at: string | null;
  last_published_by: string | null;
  updated_at: string;
};

export type BlockField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "richtext" | "image" | "color" | "url" | "link" | "number" | "select" | "switch" | "list" | "array";
  options?: string[];
  item_schema?: { fields: BlockField[] };
  items?: { fields: BlockField[] };
  item_fields?: BlockField[];
  fields?: BlockField[];
  placeholder?: string;
};

export type BlockVersion = {
  id: string;
  block_id: string;
  version: number;
  locale: string | null;
  snapshot: Record<string, any>;
  change_note: string | null;
  published_at: string;
  published_by: string | null;
};

export async function fetchBlocks(scope?: BlockScope): Promise<SiteBlock[]> {
  let q = (db as any).from("site_blocks").select("*").order("scope").order("page_slug").order("display_order");
  if (scope) q = q.eq("scope", scope);
  const { data, error } = await q;
  if (error) { warn("[site-blocks] fetch", error); return []; }
  return (data ?? []) as SiteBlock[];
}

export async function saveBlockDraft(id: string, draft: Record<string, any>) {
  const { error } = await (db as any)
    .from("site_blocks")
    .update({ draft, has_draft: true })
    .eq("id", id);
  if (error) throw error;
}

export async function discardDraft(id: string) {
  const { error } = await (db as any)
    .from("site_blocks")
    .update({ draft: null, has_draft: false })
    .eq("id", id);
  if (error) throw error;
}

export async function publishBlock(id: string, note?: string) {
  const { data, error } = await (db as any).rpc("publish_site_block", {
    p_block_id: id,
    p_change_note: note ?? null,
  });
  if (error) throw error;
  return data;
}

export async function rollbackBlock(versionId: string) {
  const { data, error } = await (db as any).rpc("rollback_site_block", {
    p_version_id: versionId,
  });
  if (error) throw error;
  return data;
}

export async function fetchBlockVersions(blockId: string): Promise<BlockVersion[]> {
  const { data, error } = await (db as any)
    .from("site_block_versions")
    .select("*")
    .eq("block_id", blockId)
    .order("version", { ascending: false });
  if (error) { warn("[site-blocks] versions", error); return []; }
  return data as BlockVersion[];
}

export async function toggleBlock(id: string, enabled: boolean) {
  const { error } = await (db as any).from("site_blocks").update({ is_enabled: enabled }).eq("id", id);
  if (error) throw error;
}

export async function reorderBlock(id: string, display_order: number) {
  const { error } = await (db as any).from("site_blocks").update({ display_order }).eq("id", id);
  if (error) throw error;
}

export function useBlocks(scope?: BlockScope) {
  const [blocks, setBlocks] = useState<SiteBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await fetchBlocks(scope);
    setBlocks(data);
    setLoading(false);
  }, [scope]);

  useEffect(() => { reload(); }, [reload]);

  return { blocks, loading, reload, setBlocks };
}

// ────────────────────────────────────────────────────────────
// Public-side helpers (Wave 4): leitura do `published` por (page_slug, block_key)
// Cache em memória + invalidação via invalidateBlocksCache().
// ────────────────────────────────────────────────────────────

type PublicBlock = {
  page_slug: string | null;
  block_key: string;
  is_enabled: boolean;
  published: Record<string, any>;
  i18n: Record<string, Record<string, any>>;
};

let _publicCache: PublicBlock[] | null = null;
let _publicPromise: Promise<PublicBlock[]> | null = null;

async function fetchPublicBlocks(): Promise<PublicBlock[]> {
  if (_publicCache) return _publicCache;
  if (_publicPromise) return _publicPromise;
  // RPC get_public_blocks(): devolve TODOS os blocos com is_enabled (inclusive os
  // desativados, com conteúdo oculto) — assim o site sabe quando uma seção está OFF.
  // Sem ela, a RLS esconderia os desativados e o toggle "ligar/desligar" não teria efeito.
  _publicPromise = (db as any)
    .rpc("get_public_blocks")
    .then(({ data, error }: any) => {
      if (error) { warn("[site-blocks] public fetch", error); return []; }
      _publicCache = (data ?? []) as PublicBlock[];
      return _publicCache!;
    });
  return _publicPromise!;
}

export function invalidateBlocksCache() {
  _publicCache = null;
  _publicPromise = null;
}

/**
 * useHomeBlocks — fonte de conteúdo da home a partir do Studio (site_blocks).
 *
 * Substitui o antigo useSiteSections (site_sections) mantendo EXATAMENTE a mesma
 * interface { sections, enabled } que a Index.tsx consome, para a troca ser
 * transparente. Cada bloco vira { key: block_key, config: published, is_enabled }.
 *
 * Segurança: se a leitura falhar, `sections` fica vazio e cada componente da
 * landing cai no seu conteúdo padrão embutido (a home nunca fica em branco).
 */
export type HomeSection = { key: string; config: Record<string, any>; is_enabled: boolean };

export function useHomeBlocks() {
  const [sections, setSections] = useState<HomeSection[] | null>(_publicCache ? _publicCache.filter((b) => b.page_slug === "home").map((b) => ({ key: b.block_key, config: b.published ?? {}, is_enabled: b.is_enabled })) : null);
  const [loading, setLoading] = useState(!_publicCache);

  useEffect(() => {
    let mounted = true;
    fetchPublicBlocks().then((blocks) => {
      if (!mounted) return;
      setSections(
        blocks
          .filter((b) => b.page_slug === "home")
          .map((b) => ({ key: b.block_key, config: b.published ?? {}, is_enabled: b.is_enabled })),
      );
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  // Live-preview do Studio: quando a home é aberta no iframe do editor, o Studio
  // emite `studio:live-preview` a cada tecla (com o draft do bloco) e
  // `studio:block-updated` ao publicar. Aqui espelhamos isso na config da seção,
  // sem persistir — o preview reflete a edição em tempo real.
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "studio:live-preview" && data.pageSlug === "home" && data.blockKey) {
        const draft = (data.draft ?? {}) as Record<string, any>;
        setSections((prev) => {
          const list = prev ?? [];
          const idx = list.findIndex((s) => s.key === data.blockKey);
          if (idx === -1) return [...list, { key: data.blockKey, config: draft, is_enabled: true }];
          const next = list.slice();
          next[idx] = { ...next[idx], config: { ...next[idx].config, ...draft } };
          return next;
        });
      }

      if (data.type === "studio:block-updated") {
        invalidateBlocksCache();
        fetchPublicBlocks().then((blocks) => {
          setSections(
            blocks
              .filter((b) => b.page_slug === "home")
              .map((b) => ({ key: b.block_key, config: b.published ?? {}, is_enabled: b.is_enabled })),
          );
        });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Mesma semântica do useSiteSections: bloco ausente => renderiza (default ON).
  const enabled = (key: string): boolean => {
    const s = sections?.find((x) => x.key === key);
    return s ? s.is_enabled : true;
  };

  return { sections, loading, enabled };
}

/**
 * usePublishedBlock — lê o conteúdo publicado de um bloco para uso público.
 * Retorna fallback enquanto carrega ou se o bloco não existir.
 *
 * @example
 *   const hero = usePublishedBlock("home", "hero", { title: "Bem-vindo" });
 */
export function usePublishedBlock<T extends Record<string, any>>(
  pageSlug: string | null,
  blockKey: string,
  fallback: T,
  locale?: string,
): T & { __enabled: boolean } {
  const [state, setState] = useState<T & { __enabled: boolean }>({ ...fallback, __enabled: true });

  useEffect(() => {
    let mounted = true;
    fetchPublicBlocks().then((blocks) => {
      if (!mounted) return;
      const b = blocks.find((x) => x.page_slug === pageSlug && x.block_key === blockKey);
      if (!b) return;
      const loc = locale && b.i18n?.[locale] ? b.i18n[locale] : null;
      const data = loc ?? b.published ?? {};
      setState({ ...fallback, ...(data as any), __enabled: b.is_enabled });
    });

    // Wave 8: ouvir live-preview vindo do Studio (postMessage)
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "studio:live-preview" && data.pageSlug === pageSlug && data.blockKey === blockKey) {
        const draft = (data.locale && data.locale !== "pt-BR" ? data.draft : data.draft) ?? {};
        if (!mounted) return;
        setState((prev) => ({ ...prev, ...draft }));
      }
      if (data.type === "studio:block-updated") {
        invalidateBlocksCache();
        fetchPublicBlocks().then((blocks) => {
          if (!mounted) return;
          const b = blocks.find((x) => x.page_slug === pageSlug && x.block_key === blockKey);
          if (!b) return;
          const loc = locale && b.i18n?.[locale] ? b.i18n[locale] : null;
          setState({ ...fallback, ...((loc ?? b.published ?? {}) as any), __enabled: b.is_enabled });
        });
      }
    };
    window.addEventListener("message", onMsg);
    return () => { mounted = false; window.removeEventListener("message", onMsg); };
  }, [pageSlug, blockKey, locale]);

  return state;
}