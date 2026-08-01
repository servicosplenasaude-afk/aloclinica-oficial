/**
 * ServiceMaintenanceBanner — faixa global de aviso honesto quando serviços
 * específicos estão temporariamente indisponíveis (ex.: criação de conta,
 * e-mail, WhatsApp). Configurado em `src/config/service-status.ts`.
 *
 * Cor âmbar (aviso, não erro), ícone de chave inglesa, dispensável pelo usuário.
 * A dispensa é lembrada pela "assinatura" (lista + nota): se o texto mudar, o
 * banner reaparece para quem já havia dispensado.
 */
import { useState } from "react";
import { Wrench, X } from "lucide-react";
import { SERVICE_MAINTENANCE } from "@/config/service-status";

const DISMISS_KEY = "aloclinica:service_maintenance_dismissed";

export function ServiceMaintenanceBanner() {
  const list = SERVICE_MAINTENANCE.services;
  const signature = `${list.join(",")}|${SERVICE_MAINTENANCE.note}`;

  const [dismissed, setDismissed] = useState<string | null>(() => {
    try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
  });

  if (!SERVICE_MAINTENANCE.enabled || list.length === 0 || dismissed === signature) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, signature); } catch {}
    setDismissed(signature);
  };

  // "a, b e c"
  const pretty = list.length === 1
    ? list[0]
    : `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}`;

  return (
    <div role="status" className="sticky top-0 z-[60] bg-amber-500 text-amber-950 px-4 py-2 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm">
        <Wrench className="w-4 h-4 shrink-0" aria-hidden />
        <p className="flex-1 leading-snug">
          <strong>Em manutenção:</strong> os serviços de {pretty} estão temporariamente indisponíveis. {SERVICE_MAINTENANCE.note}
        </p>
        <button
          onClick={dismiss}
          className="p-1 hover:bg-amber-600/40 rounded shrink-0"
          aria-label="Dispensar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default ServiceMaintenanceBanner;
