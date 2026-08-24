import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("production integration safety contracts", () => {
  it("never downgrades Evolution API traffic to plaintext HTTP", () => {
    const source = read("supabase/functions/send-whatsapp/index.ts");
    expect(source).toContain('baseUrl.startsWith("https://")');
    expect(source).not.toContain('replace(/^https:\\/\\//, "http://")');
    expect(source).not.toContain("WhatsApp logged");
  });

  it("fails closed when email delivery is not configured or rejected", () => {
    const source = read("supabase/functions/send-email/index.ts");
    expect(source).toContain('const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")');
    expect(source).not.toContain('Deno.env.get("BREVO_API_KEY") || Deno.env.get("RESEND_API_KEY")');
    expect(source).not.toContain("Email logged");
    expect(source).not.toContain("success: true, skipped: true");
  });

  it("requires the complete VAPID key pair and configurable contact subject", () => {
    const source = read("supabase/functions/send-push-notification/index.ts");
    expect(source).toContain('Deno.env.get("VAPID_PUBLIC_KEY")');
    expect(source).toContain('Deno.env.get("VAPID_PRIVATE_KEY")');
    expect(source).toContain('Deno.env.get("VAPID_SUBJECT")');
    expect(source).not.toContain("lopesgustavo4377@gmail.com");
    expect(source).toContain('appointment_id');
    expect(source).toContain('participants.includes(caller.user!.id)');
    expect(source).toContain('in_app: true');
    expect(source.indexOf('.from("notifications").insert')).toBeLessThan(source.indexOf('const VAPID_PRIVATE_KEY'));
  });

  it("keeps payment webhooks authenticated and reconciled", () => {
    const mp = read("supabase/functions/mercadopago-webhook/index.ts");
    const pagbank = read("supabase/functions/pagbank-webhook/index.ts");
    expect(mp).toContain("MERCADOPAGO_WEBHOOK_SECRET");
    expect(mp).toContain("validateSignature");
    expect(mp).toContain("payment lookup failed");
    expect(mp).not.toMatch(/if \(!res\.ok\) return;/);
    expect(pagbank).toContain("pagbankVerifyWebhook");
    for (const invariant of ["pagbank_order_id", "amount_cents", "currency", "resource_id", "patient_id"]) {
      expect(pagbank).toContain(invariant);
    }
  });
});
