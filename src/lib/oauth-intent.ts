export type OAuthRole = "patient" | "doctor" | "clinic";
export type OAuthFlow = "login" | "signup";

export interface OAuthIntent {
  flow: OAuthFlow;
  role: OAuthRole;
  redirectTo: string;
  createdAt: number;
}

const STORAGE_KEY = "aloclinica:oauth-intent";
const MAX_AGE_MS = 15 * 60 * 1000;

const safePath = (value: string) => value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";

export const saveOAuthIntent = (intent: Omit<OAuthIntent, "createdAt">) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...intent, redirectTo: safePath(intent.redirectTo), createdAt: Date.now() }));
};

export const consumeOAuthIntent = (): OAuthIntent | null => {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as OAuthIntent;
    if (!["login", "signup"].includes(value.flow) || !["patient", "doctor", "clinic"].includes(value.role)) return null;
    if (!Number.isFinite(value.createdAt) || Date.now() - value.createdAt > MAX_AGE_MS) return null;
    return { ...value, redirectTo: safePath(value.redirectTo) };
  } catch {
    return null;
  }
};
