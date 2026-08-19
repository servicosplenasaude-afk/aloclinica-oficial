import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("PagBank and withdrawal P0 contracts", () => {
  it("persists a unique PagBank intent before calling the gateway", () => {
    for (const fn of ["pagbank-create-payment", "pagbank-charge-card"]) {
      const source = read(`supabase/functions/${fn}/index.ts`);
      expect(source.indexOf('from("payment_transactions").insert')).toBeGreaterThan(0);
      expect(source.indexOf('from("payment_transactions").insert')).toBeLessThan(source.indexOf("pagbankCreateOrder(order)"));
      expect(source).toContain("pagbank_reference_id");
      expect(source).toContain("pagbank_order_id");
    }
  });

  it("reconciles webhook order, amount, currency, reference and patient", () => {
    const source = read("supabase/functions/pagbank-webhook/index.ts");
    for (const invariant of ["pagbank_order_id", "amount_cents", "currency", "resource_id", "patient_id", "price_at_booking"]) {
      expect(source).toContain(invariant);
    }
    expect(source).not.toContain("received: true, error:");
  });

  it("derives withdrawal amount in a serialized RPC and dedupes all active sources", () => {
    const sql = read("supabase/migrations/20260819180000_pagbank_withdrawal_hardening.sql");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("SUM(net_amount)");
    expect(sql).toContain("uq_withdrawal_one_active_per_user");
    expect(sql).toContain("REVOKE INSERT ON TABLE public.withdrawal_requests");
    expect(sql).toContain("claimed amount mismatch");
    expect(sql).not.toMatch(/fn_create_withdrawal_request\([\s\S]{0,100}p_amount/i);
  });

  it("aborts gateway payout when the ledger claim fails", () => {
    const source = read("supabase/functions/mercadopago-withdraw/index.ts");
    expect(source).toContain("if (claimError) throw claimError");
    expect(source).toContain("nenhum PIX foi enviado");
    expect(source).not.toContain("rpc falha e e ignorado");
  });

  it("manual and automatic flows both use the authoritative RPC", () => {
    expect(read("src/components/doctor/DoctorEarnings.tsx")).toContain('db.rpc("fn_create_withdrawal_request"');
    expect(read("supabase/functions/auto-payout-tick/index.ts")).toContain('sb.rpc("fn_create_withdrawal_request"');
  });
});
