import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const edge = readFileSync(resolve("supabase/functions/public-api/index.ts"), "utf8");
const migration = readFileSync(resolve("supabase/migrations/20260823133000_partner_api_v1.sql"), "utf8");
const admin = edge;

describe("partner API security contract", () => {
  it("fails closed and validates secrets through a private RPC", () => {
    expect(edge).toContain('sb.rpc("fn_verify_partner_api_key"');
    expect(edge).toContain("if (rateError)");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.fn_verify_partner_api_key");
    expect(migration).toContain("TO service_role");
  });

  it("prevents key owners from escalating their own scopes", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "owner manages own keys"');
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.api_keys FROM authenticated");
  });

  it("keeps booking atomic, owner-bound and idempotent", () => {
    expect(edge).toContain('requireScope("appointments:write")');
    expect(edge).toContain("key.owner_user_id");
    expect(edge).not.toMatch(/patient_id\s*:\s*payload/);
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("idempotency_conflict");
    expect(migration).toContain("tstzrange");
  });

  it("does not expose clinical or contact data in v1 selections", () => {
    expect(edge).not.toMatch(/select\([^)]*(cpf|phone|email|prescriptions|medical_records)/);
    expect(edge).toContain('path === "/v1/openapi.json"');
    expect(edge).toContain('/public-api(?=\\/|$)');
  });

  it("issues and revokes credentials only through recent admin sessions", () => {
    expect(admin).toContain("getCaller(req)");
    expect(admin).toContain("caller.isAdmin");
    expect(admin).toContain("recentAuth(req)");
    expect(admin).toContain("checkRateLimit");
    expect(admin).toContain('path === "/v1/admin/keys"');
    expect(admin).toContain('sb.rpc("fn_admin_create_partner_api_key"');
    expect(admin).toContain('sb.rpc("fn_admin_revoke_partner_api_key"');
    expect(migration).toContain("partner_api_key.created");
    expect(migration).toContain("partner_api_key.revoked");
  });
});
