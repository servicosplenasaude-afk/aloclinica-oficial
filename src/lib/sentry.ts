import * as Sentry from "@sentry/react";

// Set your Sentry DSN here or via VITE_SENTRY_DSN env variable
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "";

export const initSentry = () => {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Clinical screens may contain health data. Replays must never record
      // readable text, images, video, or audio from the consultation UI.
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.3,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.VITE_APP_ENV || import.meta.env.MODE,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.exception?.values?.[0]?.value?.includes("ResizeObserver")) return null;
      return event;
    },
  });

  
};

/**
 * Capture a custom error with context for critical flows.
 */
export const captureError = (error: Error, context?: Record<string, unknown>) => {
  if (!SENTRY_DSN) {
    console.error("[Sentry offline]", error.message, context);
    return;
  }
  Sentry.captureException(error, { extra: context });
};

/**
 * Track a custom event (e.g., payment failure, auth error).
 */
export const trackEvent = (name: string, data?: Record<string, unknown>) => {
  if (!SENTRY_DSN) return;
  Sentry.captureMessage(name, { level: "info", extra: data });
};

/**
 * Adiciona um breadcrumb pra rastrear contexto antes do erro.
 * Categorias úteis: "webrtc", "payment", "auth", "navigation", "ui".
 */
export const captureBreadcrumb = (
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: "info" | "warning" | "error" = "info",
) => {
  if (!SENTRY_DSN) return;
  Sentry.addBreadcrumb({ category, message, data, level, timestamp: Date.now() / 1000 });
};

/**
 * Identifica o usuário corrente em todos os eventos subsequentes.
 * Nunca envia PII sensível — só user_id e role. Limpa com `identifyUser(null)`.
 */
export const identifyUser = (user: { id: string; role?: string } | null) => {
  if (!SENTRY_DSN) return;
  if (user) Sentry.setUser({ id: user.id, ...(user.role ? { role: user.role } : {}) });
  else Sentry.setUser(null);
};

/** Define uma tag global (ex.: "feature_flag.icp_brasil_signature": "on"). */
export const setTag = (key: string, value: string) => {
  if (!SENTRY_DSN) return;
  Sentry.setTag(key, value);
};

export { Sentry };
