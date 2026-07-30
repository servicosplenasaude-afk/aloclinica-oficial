/**
 * MaintenanceGate — quando o admin ativa o modo manutenção (app_settings.maintenance_mode),
 * mostra uma TELA CHEIA honesta de "em manutenção" para os visitantes, enquanto o admin
 * continua navegando normalmente (allow_admin) e NADA é desligado no servidor.
 *
 * Lê `get_maintenance_status` (RPC pública). Mensagem e previsão de retorno são configuráveis
 * no painel Admin → Configurações da Plataforma.
 */
import { useEffect, useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";
import { Wrench } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type MaintenanceConfig = {
  enabled?: boolean;
  message?: string;
  expected_back_at?: string | null;
  allow_admin?: boolean;
};

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { roles } = useAuth();
  const [cfg, setCfg] = useState<MaintenanceConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchCfg = async () => {
      try {
        const { data, error } = await (db as any).rpc("get_maintenance_status");
        if (!error && !cancelled) setCfg(data as MaintenanceConfig);
      } catch { /* silencioso — na dúvida, não bloqueia */ }
    };
    fetchCfg();
    const id = setInterval(fetchCfg, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const isAdmin = roles?.includes("admin");
  // Admin passa quando allow_admin !== false. Todos os demais veem a tela.
  const blocked = Boolean(cfg?.enabled) && !(isAdmin && cfg?.allow_admin !== false);
  if (!blocked) return <>{children}</>;

  const eta = cfg?.expected_back_at ? new Date(cfg.expected_back_at) : null;
  const etaText = eta && !isNaN(eta.getTime()) ? format(eta, "dd/MM 'às' HH:mm", { locale: ptBR }) : null;
  const message = cfg?.message || "Estamos fazendo uma manutenção para melhorar sua experiência. Voltamos em instantes.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[hsl(215,75%,97%)] to-white dark:from-[hsl(215,40%,10%)] dark:to-[hsl(215,40%,7%)] px-6 py-12">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
          <Wrench className="w-9 h-9 text-primary" aria-hidden="true" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-2">AloClínica</p>
        <h1 className="text-2xl font-extrabold text-foreground mb-3">Estamos em manutenção</h1>
        <p className="text-muted-foreground leading-relaxed mb-6">{message}</p>
        {etaText && (
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm text-foreground font-medium mb-6">
            Previsão de retorno: <strong>{etaText}</strong>
          </div>
        )}
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4 text-sm text-muted-foreground">
          <p className="mb-1">Precisa de ajuda? Fale com a gente:</p>
          <p className="font-medium text-foreground">suporte@aloclinica.com.br</p>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Obrigado pela paciência — já já estamos de volta. 💙</p>
      </div>
    </div>
  );
}

export default MaintenanceGate;
