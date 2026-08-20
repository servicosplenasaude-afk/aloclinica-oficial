import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin financial mutation contracts", () => {
  it("routes manual payout confirmation through an admin-only edge function", () => {
    const ui = read("src/components/admin/AdminPayouts.tsx");
    const fn = read("supabase/functions/admin-confirm-payout/index.ts");
    expect(ui).toContain('functions.invoke("admin-confirm-payout"');
    expect(ui).not.toContain('.from("doctor_payouts")\n      .update({ status: "paid"');
    expect(fn).toContain("!caller.user || !caller.isAdmin");
    expect(fn).toContain('confirmationSource !== "external_statement_verified"');
  });

  it("keeps the atomic payout RPC private and audited", () => {
    const sql = read("supabase/migrations/20260820180000_admin_manual_payout_confirmation.sql");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("payout not ready");
    expect(sql).toContain("manual_payout_confirmed");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fn_admin_confirm_manual_payout(uuid,text,uuid) FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.fn_admin_confirm_manual_payout(uuid,text,uuid) TO service_role");
  });

  it("rejects malformed, excessive and non-refundable refund requests before gateway calls", () => {
    const publicRefund = read("supabase/functions/mercadopago-refund/index.ts");
    const internalRefund = read("supabase/functions/process-refund/index.ts");
    expect(publicRefund).toContain("Number.isSafeInteger(requestedCents)");
    expect(publicRefund).toContain("requestedCents > Number(tx.amount_cents)");
    expect(publicRefund).toContain("refundableStatuses.has(String(tx.status))");
    expect(internalRefund).toContain("Number.isSafeInteger(requestedAmountCents)");
    expect(internalRefund).toContain("requestedAmountCents! >= Number(tx.amount_cents)");
  });
});
