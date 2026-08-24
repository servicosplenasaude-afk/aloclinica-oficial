import { useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GoogleLogo, AppleLogo, SpinnerGap } from "@phosphor-icons/react";
import { logError } from "@/lib/logger";
import { saveOAuthIntent, type OAuthRole } from "@/lib/oauth-intent";

interface SocialAuthButtonsProps {
  redirectTo?: string;
  label?: string;
  hideDivider?: boolean;
  compact?: boolean;
  flow?: "login" | "signup";
  role?: OAuthRole;
  showApple?: boolean;
}

const SocialAuthButtons = ({
  redirectTo = "/dashboard",
  label = "ou continue com",
  hideDivider = false,
  compact = false,
  flow = "login",
  role = "patient",
  showApple = true,
}: SocialAuthButtonsProps) => {
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(provider);
    try {
      saveOAuthIntent({ flow, role, redirectTo });
      const { error } = await db.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
        },
      });
      if (error) throw error;
    } catch (error) {
      logError(`OAuth ${provider} error`, error);
      toast.error(`Não foi possível continuar com ${provider === "google" ? "Google" : "Apple"}`, {
        description: "Tente novamente em instantes.",
      });
      setLoading(null);
    }
  };

  const googleLabel = flow === "signup" ? "Cadastrar com Google" : "Entrar com Google";

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!hideDivider && (
        <div className="relative my-1 flex items-center gap-3">
          <span className="h-px flex-1 bg-border/70" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">{label}</span>
          <span className="h-px flex-1 bg-border/70" />
        </div>
      )}
      <div className={showApple ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2" : "grid grid-cols-1 gap-2.5"}>
        <Button type="button" variant="outline" onClick={() => handleOAuth("google")} disabled={loading !== null}
          className="h-11 rounded-xl border-border/70 bg-background font-semibold text-foreground shadow-sm transition-all hover:border-border hover:bg-muted/40">
          {loading === "google" ? <SpinnerGap className="mr-2 h-4 w-4 animate-spin" weight="bold" /> : <GoogleLogo className="mr-2 h-[18px] w-[18px]" weight="bold" />}
          <span className="text-sm">{googleLabel}</span>
        </Button>
        {showApple && (
          <Button type="button" variant="outline" onClick={() => handleOAuth("apple")} disabled={loading !== null}
            className="h-11 rounded-xl bg-foreground font-semibold text-background shadow-sm transition-all hover:bg-foreground/90 hover:text-background">
            {loading === "apple" ? <SpinnerGap className="mr-2 h-4 w-4 animate-spin" weight="bold" /> : <AppleLogo className="mr-2 h-[18px] w-[18px]" weight="fill" />}
            <span className="text-sm">Entrar com Apple</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default SocialAuthButtons;
