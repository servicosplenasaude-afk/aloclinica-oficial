/**
 * Status page público — /status
 *
 * Ping passivo dos serviços externos da AloClínica. Cada card mostra
 * estado (operacional/instável/inativo) + última verificação.
 * Re-verifica a cada 60s. Nenhum cliente, sem login.
 */
import { useEffect, useState } from "react";
import SEOHead from "@/components/SEOHead";
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { SUPABASE_FUNCTIONS_URL, SUPABASE_URL } from "@/lib/supabase-config";

type Health = "ok" | "degraded" | "down" | "checking";

interface Service {
  id: string;
  label: string;
  url: string;
  method?: "GET" | "HEAD";
  ok_status?: number[];
  description: string;
}

const SERVICES: Service[] = [
  {
    id: "frontend",
    label: "Site & app",
    url: "https://aloclinica.com.br/manifest.webmanifest",
    description: "Aplicação web e PWA (aloclinica.com.br).",
  },
  {
    id: "supabase",
    label: "Banco de dados & auth",
    url: `${SUPABASE_URL}/auth/v1/settings`,
    ok_status: [200, 401],
    description: "Supabase (autenticação, banco, edge functions).",
  },
  {
    id: "mirotalk",
    label: "Videochamadas",
    url: "https://meet.telemedicinaaloclinica.sbs/",
    description: "Servidor MiroTalk usado para a videoconsulta P2P.",
  },
  {
    id: "clinical-ai",
    label: "IA Clínica",
    url: `${SUPABASE_FUNCTIONS_URL}/clinical-ai`,
    method: "GET",
    ok_status: [400, 401, 405],
    description: "Função edge clinical-ai (triagem, resumos, interações).",
  },
];

const STYLE: Record<Health, { wrap: string; text: string; icon: any; label: string }> = {
  ok:        { wrap: "border-success/30 bg-success/5",     text: "text-success",              icon: CheckCircle2, label: "Operacional" },
  degraded:  { wrap: "border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20", text: "text-amber-600 dark:text-amber-400", icon: AlertTriangle, label: "Instável" },
  down:      { wrap: "border-destructive/40 bg-destructive/5", text: "text-destructive",          icon: XCircle,      label: "Inativo" },
  checking:  { wrap: "border-border bg-card",              text: "text-muted-foreground",     icon: Loader2,      label: "Verificando…" },
};

const Status = () => {
  const [statuses, setStatuses] = useState<Record<string, { state: Health; ms: number | null; at: Date | null }>>({});
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const checkAll = async () => {
    const init: Record<string, { state: Health; ms: number | null; at: Date | null }> = {};
    SERVICES.forEach((s) => { init[s.id] = { state: "checking", ms: null, at: null }; });
    setStatuses((prev) => ({ ...init, ...prev }));

    await Promise.all(SERVICES.map(async (s) => {
      const start = performance.now();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(s.url, { method: s.method ?? "GET", signal: ctrl.signal, mode: "no-cors" });
        clearTimeout(timer);
        const ms = Math.round(performance.now() - start);
        const ok = s.ok_status ? s.ok_status.includes(res.status) : (res.ok || res.status === 0 /* no-cors opaque */ );
        const state: Health = ok ? (ms > 2500 ? "degraded" : "ok") : "degraded";
        setStatuses((prev) => ({ ...prev, [s.id]: { state, ms, at: new Date() } }));
      } catch {
        const ms = Math.round(performance.now() - start);
        setStatuses((prev) => ({ ...prev, [s.id]: { state: "down", ms, at: new Date() } }));
      }
    }));
    setLastRefresh(new Date());
  };

  useEffect(() => {
    checkAll();
    const t = setInterval(checkAll, 60_000);
    return () => clearInterval(t);
  }, []);

  const overall: Health = (() => {
    const states = Object.values(statuses).map((s) => s.state);
    if (states.some((s) => s === "down")) return "down";
    if (states.some((s) => s === "degraded")) return "degraded";
    if (states.length && states.every((s) => s === "ok")) return "ok";
    return "checking";
  })();
  const O = STYLE[overall];

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4">
      <SEOHead title="Status | AloClínica" description="Status em tempo real dos serviços da AloClínica." />
      <div className="max-w-2xl mx-auto">
        <div className={`rounded-2xl border ${O.wrap} p-5 mb-6 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-card flex items-center justify-center">
              <O.icon className={`w-6 h-6 ${O.text} ${overall === "checking" ? "animate-spin" : ""}`} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">AloClínica</h1>
              <p className={`text-sm font-semibold ${O.text}`}>
                {overall === "ok" ? "Tudo funcionando normalmente" : overall === "degraded" ? "Algum serviço com lentidão" : overall === "down" ? "Há serviço inativo" : "Verificando…"}
              </p>
            </div>
          </div>
          <button onClick={checkAll} aria-label="Verificar agora" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-card transition">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-2">
          {SERVICES.map((s) => {
            const st = statuses[s.id] ?? { state: "checking" as Health, ms: null, at: null };
            const S = STYLE[st.state];
            const Icon = S.icon;
            return (
              <div key={s.id} className={`rounded-xl border ${S.wrap} p-4 flex items-center gap-3`}>
                <Icon className={`w-5 h-5 ${S.text} shrink-0 ${st.state === "checking" ? "animate-spin" : ""}`} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{s.label}</p>
                    <span className={`text-xs font-semibold ${S.text}`}>{S.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-0.5">
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{s.description}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                      {st.ms != null ? `${st.ms} ms` : "—"}{st.at ? ` · ${st.at.toLocaleTimeString("pt-BR")}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center text-[11px] text-muted-foreground">
          <p className="inline-flex items-center gap-1.5"><Activity className="w-3 h-3" /> Atualização automática a cada 60s</p>
          {lastRefresh && <p className="mt-1">Última verificação: {lastRefresh.toLocaleString("pt-BR")}</p>}
          <p className="mt-3">Dúvidas? <a href="mailto:suporte@aloclinica.com.br" className="text-primary hover:underline">suporte@aloclinica.com.br</a></p>
        </div>
      </div>
    </div>
  );
};

export default Status;
