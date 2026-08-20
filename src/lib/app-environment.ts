export type AppEnvironment = "development" | "sandbox" | "production";

const rawEnvironment = import.meta.env.VITE_APP_ENV?.trim().toLowerCase();
const sandboxHostname =
  typeof window !== "undefined" &&
  (window.location.hostname === "sandbox.aloclinica.com.br" ||
    window.location.hostname.endsWith(".aloclinica-sandbox.pages.dev"));

export const appEnvironment: AppEnvironment =
  rawEnvironment === "sandbox" || sandboxHostname
    ? "sandbox"
    : rawEnvironment === "production"
      ? "production"
      : "development";

export const isSandbox = appEnvironment === "sandbox";
