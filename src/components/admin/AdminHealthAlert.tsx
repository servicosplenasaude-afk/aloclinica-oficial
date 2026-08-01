/**
 * AdminHealthAlert — alerta PROATIVO no painel admin.
 *
 * Roda em segundo plano (só para admin, só nas telas do painel /dashboard),
 * verifica os serviços a cada poucos minutos e, se algum estiver COM FALHA,
 * mostra uma faixa vermelha no topo com o link para "Saúde do Sistema".
 *
 * Assim o dono não precisa lembrar de abrir a página — o problema salta à vista.
 * Montado globalmente em App.tsx; ele mesmo decide quando aparecer.
 */
import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { AlertTriangle, X, Activity } from "lucide-react";
import { useServiceHealth } from "@/hooks/use-service-health";

export function AdminHealthAlert() {
  const location = useLocation();
  const onAdminPanel = location.pathname.startsWith("/dashboard");
  const { summary, downServices, lastRun } = useServiceHealth({ enabled: onAdminPanel, poll: true });
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  if (summary.down === 0) return null;
  // Se dispensado, some por 30 min (reaparece se continuar quebrado).
  if (dismissedAt && Date.now() - dismissedAt < 30 * 60 * 1000) return null;

  const names = downServices.map((s) => s.label).join(", ");
  const plural = summary.down > 1;

  return (
    <div role="alert" className="sticky top-0 z-[70] bg-red-600 text-white px-4 py-2 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm">
        <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden />
        <p className="flex-1 leading-snug">
          <strong>{summary.down} serviço{plural ? "s" : ""} com falha:</strong> {names}.
          {" "}Os usuários podem ser afetados.
        </p>
        <Link
          to="/dashboard/admin/health?role=admin"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1 font-semibold transition-colors shrink-0"
        >
          <Activity className="w-4 h-4" /> Ver detalhes
        </Link>
        <button
          onClick={() => setDismissedAt(Date.now())}
          className="p-1 hover:bg-white/20 rounded shrink-0"
          aria-label="Dispensar por 30 minutos"
          title="Dispensar por 30 minutos"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default AdminHealthAlert;
