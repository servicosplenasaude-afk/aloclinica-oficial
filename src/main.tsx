import { createRoot } from "react-dom/client";
import "./index.css";
import "./App.css";
import { logError } from "./lib/logger";
// push-service-worker cleanup deferred to after mount
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { MotionConfig } from "framer-motion";

/* ── Chunk-error recovery ─────────────────────────────── */
const CHUNK_RELOAD_KEY = "__chunk_reloaded";
const CHUNK_RE = /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i;

const isChunkError = (v: unknown) => {
  const msg = v instanceof Error ? v.message : typeof v === "string" ? v : "";
  return CHUNK_RE.test(msg);
};

const getReloadFlag = () => {
  try { return sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1"; } catch { return false; }
};
const setReloadFlag = () => {
  try { sessionStorage.setItem(CHUNK_RELOAD_KEY, "1"); } catch {}
};
const clearReloadFlag = () => {
  try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch {}
};

const recover = () => {
  if (getReloadFlag()) { clearReloadFlag(); return; }
  setReloadFlag();
  const reset = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}
    window.location.reload();
  };
  void reset();
};

window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); recover(); });
window.addEventListener("unhandledrejection", (e) => {
  if (isChunkError(e.reason)) { e.preventDefault(); recover(); }
});
window.addEventListener("error", (e) => {
  if (isChunkError((e as ErrorEvent).error ?? (e as ErrorEvent).message)) recover();
}, true);

// Defer Sentry and SW cleanup to after mount to reduce main-thread work during boot
requestIdleCallback(() => {
  import("./lib/sentry").then(({ initSentry }) => initSentry()).catch(() => {});

  // Bootstrap nativo Capacitor (no-op no web)
  import("./lib/capacitor-init").then(({ initCapacitor }) => initCapacitor()).catch(() => {});

  const isPreviewEnvironment = window.location.hostname.startsWith("id-preview--");
  if ("serviceWorker" in navigator) {
    if (isPreviewEnvironment) {
      void navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister()))).catch(() => {});
      if ("caches" in window) {
        void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
      }
    } else {
      import("@/lib/push-service-worker")
        .then(async ({ deleteLegacySensitiveCaches, unregisterLegacyRootPushServiceWorkers }) => {
          await Promise.all([
            unregisterLegacyRootPushServiceWorkers(),
            deleteLegacySensitiveCaches(),
          ]);
        })
        .catch(() => {});
    }
  }
}, { timeout: 5000 });

// requestIdleCallback polyfill for Safari
function requestIdleCallback(cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void, opts?: { timeout: number }) {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(cb, opts);
  } else {
    setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), opts?.timeout ?? 1000);
  }
}

/* ── Mount ─────────────────────────────────────────────── */
const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

document.documentElement.setAttribute("data-app-booting", "true");
document.body.setAttribute("data-app-booting", "true");

try {
  createRoot(root).render(
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ErrorBoundary>,
  );
  document.documentElement.removeAttribute("data-app-booting");
  document.body.removeAttribute("data-app-booting");
  clearReloadFlag();
} catch (err) {
  if (isChunkError(err)) { recover(); }
  else {
    logError("[boot] Fatal mount error", err);
    const shell = document.createElement("div");
    shell.className = "flex min-h-screen items-center justify-center font-sans";
    const content = document.createElement("div");
    content.className = "text-center";
    const title = document.createElement("h2");
    title.textContent = "Erro ao carregar";
    const message = document.createElement("p");
    message.textContent = "Recarregue a página.";
    const reload = document.createElement("button");
    reload.type = "button";
    reload.className = "mt-3 cursor-pointer rounded-md border px-4 py-2";
    reload.textContent = "Recarregar";
    reload.addEventListener("click", () => window.location.reload());
    content.append(title, message, reload);
    shell.append(content);
    root.replaceChildren(shell);
  }
}
