import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/untyped", () => ({ db: { rpc } }));

import { adminRoleErrorMessage, setAdminManagedUserRoles } from "@/lib/admin-user-roles";

describe("gestão administrativa de roles", () => {
  beforeEach(() => rpc.mockReset());

  it("normaliza roles e usa a operação atômica do servidor", async () => {
    rpc.mockResolvedValue({ error: null });
    await setAdminManagedUserRoles("user-1", ["patient", "admin", "patient"]);
    expect(rpc).toHaveBeenCalledWith("admin_set_user_roles", {
      p_target_user_id: "user-1",
      p_roles: ["admin", "patient"],
    });
  });

  it("propaga falhas do servidor", async () => {
    const error = { message: "LAST_ADMIN_PROTECTED" };
    rpc.mockResolvedValue({ error });
    await expect(setAdminManagedUserRoles("user-1", [])).rejects.toBe(error);
  });

  it("traduz recusas críticas sem vazar detalhes internos", () => {
    expect(adminRoleErrorMessage({ message: "LAST_ADMIN_PROTECTED" })).toMatch(/último administrador/i);
    expect(adminRoleErrorMessage({ message: "RECENT_AUTH_REQUIRED" })).toMatch(/autenticação expirou/i);
    expect(adminRoleErrorMessage({ message: "database internals" })).toBe("Não foi possível atualizar as permissões.");
  });

  it("mantém no banco as garantias críticas", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260820231000_secure_admin_role_management.sql"), "utf8");
    expect(sql).toContain("public.has_role(v_actor_id, 'admin'::public.app_role)");
    expect(sql).toContain("RECENT_AUTH_REQUIRED");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("LAST_ADMIN_PROTECTED");
    expect(sql).toContain("CREATE TRIGGER protect_last_admin_role_trigger");
    expect(sql).toContain("BEFORE DELETE OR UPDATE OF role ON public.user_roles");
    expect(sql).toContain("INSERT INTO public.activity_logs");
    expect(sql).toContain("REVOKE ALL ON FUNCTION");
  });
});
