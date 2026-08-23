import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Cookie, Settings2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { logConsent } from "@/lib/consent";

const STORAGE_KEY = "cookie_consent_v2";

type Prefs = { essential: true; analytics: boolean; marketing: boolean };

const loadPrefs = (): Prefs | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { essential: true, analytics: !!parsed.analytics, marketing: !!parsed.marketing };
  } catch { return null; }
};

const savePrefs = async (prefs: Prefs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, accepted_at: new Date().toISOString() }));
  } catch { /* storage blocked */ }
  // Append-only audit log (works for anonymous visitors too).
  await logConsent({
    type: prefs.analytics && prefs.marketing
      ? "cookies_all"
      : prefs.analytics || prefs.marketing
        ? "cookies_analytics"
        : "cookies_essential",
    accepted: true,
    metadata: prefs,
  });
};

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!loadPrefs()) setVisible(true);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("cookie-consent-visibility", { detail: { visible } }));
    return () => {
      window.dispatchEvent(new CustomEvent("cookie-consent-visibility", { detail: { visible: false } }));
    };
  }, [visible]);

  const acceptAll = async () => {
    await savePrefs({ essential: true, analytics: true, marketing: true });
    setVisible(false);
  };
  const rejectAll = async () => {
    await savePrefs({ essential: true, analytics: false, marketing: false });
    await logConsent({ type: "cookies_rejected", accepted: false });
    setVisible(false);
  };
  const saveCustom = async () => {
    await savePrefs({ essential: true, analytics, marketing });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      id="cookie-consent-banner"
      role="region"
      aria-label="Preferências de cookies"
      className="fixed bottom-0 inset-x-0 z-50 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:p-6 pointer-events-none"
    >
      <div className="pointer-events-auto max-h-[min(62dvh,34rem)] overflow-y-auto overscroll-contain max-w-xl mx-auto rounded-2xl border border-border bg-card shadow-2xl p-3 sm:p-6 space-y-2 sm:space-y-4">
        <div className="flex items-start gap-3">
          <Cookie className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Privacidade e Cookies (LGPD)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Usamos cookies essenciais e, com sua autorização, cookies de análise e marketing. Você pode aceitar,
              recusar ou personalizar. Veja a{" "}
              <Link to="/cookies" className="underline text-primary hover:text-primary/80">Política de Cookies</Link>{" "}
              e a <Link to="/lgpd" className="underline text-primary hover:text-primary/80">Política LGPD</Link>.
            </p>
          </div>
        </div>

        {showPrefs && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
            <label className="flex items-start gap-2 text-xs text-muted-foreground opacity-70 cursor-not-allowed">
              <Checkbox checked disabled className="mt-0.5" />
              <span><strong className="text-foreground">Essenciais</strong> — necessários para login, agendamento e segurança. Sempre ativos.</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={analytics} onCheckedChange={(v) => setAnalytics(v === true)} className="mt-0.5" />
              <span><strong className="text-foreground">Análise</strong> — métricas anônimas de uso para melhorar a plataforma.</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} className="mt-0.5" />
              <span><strong className="text-foreground">Marketing</strong> — personalização de comunicações e campanhas.</span>
            </label>
          </div>
        )}

        <div className="grid grid-cols-3 sm:flex gap-2 sm:justify-end">
          {!showPrefs && (
            <Button variant="ghost" size="sm" className="min-h-11 rounded-xl px-2 text-[11px] sm:text-xs" onClick={() => setShowPrefs(true)}>
              <Settings2 className="hidden sm:block w-3.5 h-3.5 mr-1" /> Personalizar
            </Button>
          )}
          <Button variant="outline" size="sm" className="min-h-11 rounded-xl px-2 text-[11px] sm:text-xs" onClick={rejectAll}>
            <span className="sm:hidden">Só essenciais</span><span className="hidden sm:inline">Recusar opcionais</span>
          </Button>
          {showPrefs ? (
            <Button size="sm" className="min-h-11 rounded-xl px-2 text-[11px] sm:text-xs" onClick={saveCustom}>
              Salvar preferências
            </Button>
          ) : (
            <Button size="sm" className="min-h-11 rounded-xl px-2 text-[11px] sm:text-xs" onClick={acceptAll}>
              Aceitar todos
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
