export type AppEnvironment = "development" | "sandbox" | "production";

const rawEnvironment = import.meta.env.VITE_APP_ENV?.trim().toLowerCase();

export const appEnvironment: AppEnvironment =
  rawEnvironment === "sandbox"
    ? "sandbox"
    : rawEnvironment === "production"
      ? "production"
      : "development";

export const isSandbox = appEnvironment === "sandbox";
