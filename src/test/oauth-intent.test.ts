import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeOAuthIntent, saveOAuthIntent } from "@/lib/oauth-intent";

describe("OAuth intent", () => {
  beforeEach(() => sessionStorage.clear());

  it("preserva um destino interno e consome a intenção uma única vez", () => {
    saveOAuthIntent({ flow: "signup", role: "doctor", redirectTo: "/medico/cadastro" });
    expect(consumeOAuthIntent()).toMatchObject({ flow: "signup", role: "doctor", redirectTo: "/medico/cadastro" });
    expect(consumeOAuthIntent()).toBeNull();
  });

  it("bloqueia redirecionamento externo", () => {
    saveOAuthIntent({ flow: "login", role: "patient", redirectTo: "//evil.example" });
    expect(consumeOAuthIntent()?.redirectTo).toBe("/dashboard");
  });

  it("descarta intenção expirada", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(1_000 + 16 * 60 * 1000);
    saveOAuthIntent({ flow: "login", role: "patient", redirectTo: "/dashboard" });
    expect(consumeOAuthIntent()).toBeNull();
    vi.restoreAllMocks();
  });
});
