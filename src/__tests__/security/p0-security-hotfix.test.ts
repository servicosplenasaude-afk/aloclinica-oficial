import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expectSqlContract, readMigration } from "@/test/sql-security";

const migrationName = "20260819000100_p0_security_hotfix.sql";

describe("P0 security hotfix offline contracts", () => {
  it("removes cross-user profile reads and scopes doctor access to active consultations", () => {
    const sql = readMigration(migrationName);

    expectSqlContract(sql, [
      'DROP POLICY IF EXISTS "Users can view all basic profiles" ON public.profiles',
      'DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles',
      'TO authenticated USING ( EXISTS ( SELECT 1 FROM public.appointments a',
      'a.patient_id = profiles.user_id',
      'dp.user_id = auth.uid()',
      "a.status IN ('scheduled', 'waiting', 'confirmed', 'in_progress')",
    ]);
    expect(sql).not.toMatch(/create policy[^;]+profiles[^;]+using\s*\(\s*true\s*\)/);
  });

  it("builds public verification details from a medication-count allowlist", () => {
    const sql = readMigration(migrationName);

    expectSqlContract(sql, [
      "jsonb_build_object( 'medication_count'",
      "REVOKE ALL ON FUNCTION public.verify_document_public(text) FROM PUBLIC",
      "GRANT EXECUTE ON FUNCTION public.verify_document_public(text) TO anon, authenticated",
    ]);
    expect(sql).not.toMatch(/details\s*-\s*'cid'/);
    expect(sql).not.toMatch(/as issued_at,\s*coalesce\(dv\.details/);
  });

  it("requires authenticated identity and ignores client-declared roles in ai-assistant", () => {
    const source = readFileSync(
      resolve(process.cwd(), "supabase", "functions", "ai-assistant", "index.ts"),
      "utf8",
    );

    expect(source).toContain("const caller = await getCaller(req)");
    expect(source).toContain("if (!caller.user || !caller.client)");
    expect(source).toContain('.from("user_roles")');
    expect(source).toContain("const { messages, context } = await req.json()");
    expect(source).not.toMatch(/const\s*\{[^}]*\brole\b[^}]*\}\s*=\s*await req\.json/);
    expect(source).not.toContain('req.headers.get("x-forwarded-for")');
  });

  it("fails closed when authorization or rate-limit storage fails", () => {
    const source = readFileSync(
      resolve(process.cwd(), "supabase", "functions", "ai-assistant", "index.ts"),
      "utf8",
    );

    expect(source).toContain("if (roleError)");
    expect(source).toContain('.rpc("check_ai_assistant_rate_limit"');
    expect(source).toContain("return !error && data === true");
    expect(source).toMatch(/catch\s*\{\s*return false;\s*\}/);
    expect(source).not.toMatch(/catch\s*\{\s*return true;\s*\}/);
  });

  it("serializes rate-limit decisions and keeps the RPC service-only", () => {
    const sql = readMigration(migrationName);

    expectSqlContract(sql, [
      "pg_advisory_xact_lock(hashtextextended(p_identifier || ':' || p_endpoint, 0))",
      "IF v_count >= p_max_requests THEN RETURN false",
      "EXCEPTION WHEN OTHERS THEN RETURN false",
      "REVOKE ALL ON FUNCTION public.check_ai_assistant_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated",
      "GRANT EXECUTE ON FUNCTION public.check_ai_assistant_rate_limit(text, text, integer, integer) TO service_role",
    ]);
  });
});
