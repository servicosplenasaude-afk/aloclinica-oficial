import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SpinnerGap } from "@phosphor-icons/react";
import { db } from "@/integrations/supabase/untyped";
import { consumeOAuthIntent } from "@/lib/oauth-intent";
import { logError } from "@/lib/logger";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Confirmando seu acesso seguro…");

  useEffect(() => {
    let active = true;
    const finish = async () => {
      try {
        const intent = consumeOAuthIntent();
        const { data, error } = await db.auth.getSession();
        if (error || !data.session) throw error || new Error("Sessão OAuth não encontrada");

        if (intent?.flow === "signup") {
          setMessage("Preparando seu cadastro…");
          const { error: completionError } = await db.rpc("complete_google_oauth_signup", { p_role: intent.role });
          if (completionError) throw completionError;
          if (intent.role === "doctor") {
            navigate("/medico/cadastro?oauth=complete", { replace: true });
            return;
          }
          if (intent.role === "clinic") {
            navigate("/clinica/cadastro?oauth=complete", { replace: true });
            return;
          }
        }
        navigate(intent?.redirectTo || "/dashboard", { replace: true });
      } catch (error) {
        logError("OAuth callback error", error);
        if (!active) return;
        setMessage("Não foi possível concluir o acesso. Redirecionando para o login…");
        window.setTimeout(() => navigate("/paciente", { replace: true }), 1800);
      }
    };
    void finish();
    return () => { active = false; };
  }, [navigate]);

  return <main className="grid min-h-screen place-items-center bg-background px-6"><div className="flex max-w-sm flex-col items-center gap-4 text-center"><SpinnerGap className="h-10 w-10 animate-spin text-primary" weight="bold" /><h1 className="text-xl font-bold text-foreground">Acesso com Google</h1><p className="text-sm text-muted-foreground" role="status">{message}</p></div></main>;
};

export default OAuthCallback;
