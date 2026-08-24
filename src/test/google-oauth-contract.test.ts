import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Google OAuth contracts", () => {
  it("usa callback dedicado e não redireciona o provedor direto ao dashboard", () => {
    const buttons = read("src/components/auth/SocialAuthButtons.tsx");
    const app = read("src/App.tsx");
    expect(buttons).toContain("/auth/callback");
    expect(app).toContain('path="/auth/callback"');
  });

  it("mantém cadastro Google disponível apenas nos papéis públicos", () => {
    const migration = read("supabase/migrations/20260824160000_google_oauth_signup_completion.sql");
    expect(migration).toContain("('patient', 'doctor', 'clinic')");
    expect(migration).toContain("GOOGLE_IDENTITY_REQUIRED");
    expect(migration).toContain("SIGNUP_WINDOW_EXPIRED");
    expect(migration).toContain("REVOKE ALL");
  });

  it("mantém médico e clínica em seus formulários de conclusão", () => {
    const callback = read("src/pages/OAuthCallback.tsx");
    expect(callback).toContain('/medico/cadastro?oauth=complete');
    expect(callback).toContain('/clinica/cadastro?oauth=complete');
    expect(read("src/pages/SignupDoctor.tsx")).toContain('role="doctor"');
    expect(read("src/pages/SignupClinic.tsx")).toContain('role="clinic"');
  });
});
