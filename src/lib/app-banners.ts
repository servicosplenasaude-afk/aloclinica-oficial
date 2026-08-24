import { useMemo } from "react";
import { useSiteConfig } from "@/lib/site-config";

export type AppBannerAudience = "all" | "patient" | "doctor" | "clinic" | "admin" | "support" | "partner";
export type AppBannerPlacement = "dashboard" | "schedule" | "waiting-room" | "global";

export interface AppPromoBanner {
  id: string;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  cta_label?: string;
  cta_href?: string;
  image_url?: string;
  audience: AppBannerAudience;
  placement: AppBannerPlacement;
  enabled: boolean;
  priority: number;
  starts_at?: string;
  ends_at?: string;
  theme?: "blue" | "emerald" | "violet" | "amber" | "rose";
}

export const DEFAULT_APP_BANNERS: AppPromoBanner[] = [
  {
    id: "default-telemedicine",
    title: "Consulta online com segurança",
    subtitle: "Encontre especialistas verificados e cuide da saúde sem sair de casa.",
    eyebrow: "Telemedicina",
    cta_label: "Agendar agora",
    cta_href: "/dashboard/schedule?role=patient",
    image_url: "/images/app-promo-telemedicine.png",
    audience: "patient",
    placement: "global",
    enabled: true,
    priority: 10,
    theme: "blue",
  },
  {
    id: "default-doctor-agenda",
    title: "Agenda inteligente para atender melhor",
    subtitle: "Acompanhe fila, próximas consultas e performance em tempo real.",
    eyebrow: "Médicos",
    cta_label: "Ver agenda",
    cta_href: "/dashboard/doctor/calendar?role=doctor",
    image_url: "/images/app-promo-doctor-agenda.webp",
    audience: "doctor",
    placement: "global",
    enabled: true,
    priority: 9,
    theme: "emerald",
  },
];

function isBannerVisible(banner: AppPromoBanner, role: string, placement: AppBannerPlacement) {
  if (!banner.enabled) return false;
  if (banner.audience !== "all" && banner.audience !== role) return false;
  if (banner.placement !== "global" && banner.placement !== placement) return false;
  const now = Date.now();
  if (banner.starts_at && new Date(banner.starts_at).getTime() > now) return false;
  if (banner.ends_at && new Date(banner.ends_at).getTime() < now) return false;
  return true;
}

export function parseAppBanners(raw: string | undefined | null): AppPromoBanner[] {
  if (!raw) return DEFAULT_APP_BANNERS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_APP_BANNERS;
    return parsed.map((item, index) => ({
      id: String(item.id || `banner-${index + 1}`),
      title: String(item.title || "Banner promocional"),
      subtitle: item.subtitle ? String(item.subtitle) : "",
      eyebrow: item.eyebrow ? String(item.eyebrow) : "",
      cta_label: item.cta_label ? String(item.cta_label) : "",
      cta_href: item.cta_href ? String(item.cta_href) : "",
      image_url: item.image_url ? String(item.image_url) : "",
      audience: (item.audience || "all") as AppBannerAudience,
      placement: (item.placement || "dashboard") as AppBannerPlacement,
      enabled: item.enabled !== false,
      priority: Number(item.priority ?? 0),
      starts_at: item.starts_at ? String(item.starts_at) : "",
      ends_at: item.ends_at ? String(item.ends_at) : "",
      theme: item.theme || "blue",
    }));
  } catch {
    return DEFAULT_APP_BANNERS;
  }
}

export function useAppPromoBanners(role: string, placement: AppBannerPlacement = "dashboard") {
  const { get, loading } = useSiteConfig();
  const raw = get("app_promotional_banners", "");
  const banners = useMemo(() => {
    return parseAppBanners(raw)
      .filter((banner) => isBannerVisible(banner, role, placement))
      .sort((a, b) => b.priority - a.priority);
  }, [raw, role, placement]);

  return { banners, loading };
}
