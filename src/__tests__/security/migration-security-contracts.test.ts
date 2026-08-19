import { describe, expect, it } from "vitest";
import { expectSqlContract, readMigration } from "@/test/sql-security";

describe("offline database security contracts", () => {
  it("whitelists self-service signup roles and falls back to patient", () => {
    const sql = readMigration("20260724190000_signup_role_whitelist.sql");

    expectSqlContract(sql, [
      "SECURITY DEFINER SET search_path TO 'public'",
      "IF v_role NOT IN ('patient', 'doctor', 'clinic') THEN v_role := 'patient'",
      "EXCEPTION WHEN invalid_text_representation THEN v_app_role := 'patient'::app_role",
    ]);
    expect(sql).not.toContain("'admin', 'support'");
  });

  it("prevents patients from activating their own Pingo subscription", () => {
    const sql = readMigration("20260724150000_pingo_subscription_rls_lockdown.sql");

    expectSqlContract(sql, [
      "WITH CHECK (auth.uid() = user_id AND status = 'pending')",
      "USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND status IN ('cancelled','canceled'))",
    ]);
    expect(sql).not.toMatch(/with check \([^)]*status\s*=\s*'active'/);
  });

  it("keeps money-moving payout RPCs exclusive to service_role", () => {
    const sql = readMigration("20260722120000_payout_atomic_claim.sql");
    const signatures = [
      "public.fn_claim_ready_payouts(uuid, uuid)",
      "public.fn_unclaim_payouts(uuid, uuid)",
      "public.fn_doctor_available_balance(uuid)",
    ];

    for (const signature of signatures) {
      expectSqlContract(sql, [
        `REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated`,
        `GRANT EXECUTE ON FUNCTION ${signature} TO service_role`,
      ]);
      expect(sql).not.toContain(`grant execute on function ${signature} to authenticated`);
      expect(sql).not.toContain(`grant execute on function ${signature} to anon`);
    }
  });

  it("blocks direct invite enumeration while exposing only token-scoped preview", () => {
    const sql = readMigration("20260724200000_contract_invite_read_lockdown.sql");

    expectSqlContract(sql, [
      "SECURITY DEFINER SET search_path TO 'public'",
      "WHERE cmi.token = p_token LIMIT 1",
      'ALTER POLICY "public reads invite by token" ON public.contract_manager_invites USING (false)',
    ]);
    expect(sql).not.toContain("using (true)");
  });

  it("isolates clinical protocols to their owner, globals, or admins", () => {
    const sql = readMigration("20260805150000_clinical_protocols_isolation.sql");

    expectSqlContract(sql, [
      'DROP POLICY IF EXISTS "anyone authenticated reads active protocols"',
      "FOR SELECT USING ( public.has_role(auth.uid(), 'admin'::public.app_role) OR created_by = auth.uid() OR created_by IS NULL )",
      "FOR ALL USING ( public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.uid() = created_by ) WITH CHECK ( public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.uid() = created_by )",
    ]);
  });
});
