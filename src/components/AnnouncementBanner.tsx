/**
 * AnnouncementBanner — banner global de anúncio configurável pelo admin.
 *
 * Lê `app_settings.global_announcement` = { active, message } (mesmo padrão de
 * leitura usado em AdminPlatformSettings). Quando active=true e há mensagem,
 * mostra uma faixa azul dispensável no topo do site.
 *
 * A dispensa é lembrada por mensagem (localStorage): trocar o texto do anúncio
 * faz o banner reaparecer para quem já havia dispensado o anterior.
 *
 * Onde montar: ao lado de <MaintenanceBanner /> em App.tsx (topo global) para
 * exibir app-wide. Ex.:
 *   <MaintenanceBanner />
 *   <AnnouncementBanner />
 */
import { useEffect, useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import { Megaphone, X } from "lucide-react";

type AnnouncementConfig = {
  active?: boolean;
  message?: string;
};

const DISMISS_KEY = "aloclinica:announcement_dismissed";

export function AnnouncementBanner() {
  const [cfg, setCfg] = useState<AnnouncementConfig | null>(null);
  const [dismissedMsg, setDismissedMsg] = useState<string | null>(() => {
    try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
  });

  useEffect(() => {
    let cancelled = false;
    const fetchCfg = async () => {
      try {
        const { data, error } = await (db as any).rpc("get_public_announcement");
        if (!error && !cancelled) setCfg((data ?? null) as AnnouncementConfig | null);
      } catch {}
    };
    fetchCfg();
    // Re-checa a cada 60s pra detectar mudanças (igual ao MaintenanceBanner)
    const id = setInterval(fetchCfg, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const message = cfg?.message?.trim();
  if (!cfg?.active || !message || dismissedMsg === message) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, message); } catch {}
    setDismissedMsg(message);
  };

  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-sky-600 text-sky-50 px-4 py-2 shadow-md"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm">
        <Megaphone className="w-4 h-4 shrink-0" />
        <div className="flex-1">{message}</div>
        <button
          onClick={dismiss}
          className="p-1 hover:bg-sky-700 rounded"
          aria-label="Dispensar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default AnnouncementBanner;
