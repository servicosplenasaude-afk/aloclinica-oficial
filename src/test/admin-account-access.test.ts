import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/untyped", () => ({ db: { functions: { invoke } } }));

import { changeAdminManagedAccountAccess } from "@/lib/admin-account-access";

describe("controle administrativo de acesso", () => {
  beforeEach(() => invoke.mockReset());

  it("envia somente a ação suportada para a Edge Function", async () => {
    invoke.mockResolvedValue({ data: { ok: true, status: "suspended", notice: "limited" }, error: null });
    await changeAdminManagedAccountAccess("target-id", "suspend");
    expect(invoke).toHaveBeenCalledWith("admin-account-access", {
      body: { user_id: "target-id", action: "suspend" },
    });
  });

  it("propaga recusas da função", async () => {
    const error = new Error("forbidden");
    invoke.mockResolvedValue({ data: null, error });
    await expect(changeAdminManagedAccountAccess("target-id", "reactivate")).rejects.toBe(error);
  });

  it("mantém autorização, autenticação recente, rate limit fechado, auto-proteção e auditoria", () => {
    const source = readFileSync(resolve(process.cwd(), "supabase/functions/admin-account-access/index.ts"), "utf8");
    expect(source).toContain("!caller.user || !caller.isAdmin");
    expect(source).toContain("RECENT_AUTH_REQUIRED");
    expect(source).toContain('checkRateLimit(caller.user.id, "admin-account-access", 10, 5, true)');
    expect(source).toContain("targetUserId === caller.user.id");
    expect(source).toContain('action: action === "suspend" ? "user_account.suspend_requested"');
    expect(source).toContain('ban_duration: action === "suspend" ? "876000h" : "none"');
    expect(source).toContain("existing_access_tokens_may_remain_valid_until_expiry");
  });
});
