const DEFAULT_SUPABASE_URL = "https://pwxvvimdtmvziynbspgx.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3eHZ2aW1kdG12eml5bmJzcGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjMwNDAsImV4cCI6MjA5MTY5OTA0MH0.GYOrbxDlr_GxII92m6Fk7BiVoT5D2uuAk4Uhn0PZzNM";

const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const appEnvironment = import.meta.env.VITE_APP_ENV?.trim().toLowerCase();

if (appEnvironment === "sandbox") {
  if (!envUrl || !envKey) {
    throw new Error("Sandbox bloqueado: configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.");
  }
  if (envUrl === DEFAULT_SUPABASE_URL) {
    throw new Error("Sandbox bloqueado: o projeto Supabase de produção não pode ser usado.");
  }
}

export const SUPABASE_URL = envUrl || DEFAULT_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = envKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
export const SUPABASE_PROJECT_ID = new URL(SUPABASE_URL).hostname.split(".")[0];
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
export const hasExplicitSupabaseEnv = Boolean(envUrl && envKey);

if (!hasExplicitSupabaseEnv && import.meta.env.DEV) {
  console.warn(
    "[AloClinica] VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY ausentes. Usando defaults publicos de producao.",
  );
}
