import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin communication safety contracts", () => {
  it("routes broadcasts through an admin-only, audited server operation", () => {
    const ui = read("src/components/admin/AdminBroadcast.tsx");
    const fn = read("supabase/functions/admin-broadcast/index.ts");
    const sql = read("supabase/migrations/20260820200000_admin_broadcast_atomic.sql");
    expect(ui).toContain('functions.invoke("admin-broadcast"');
    expect(ui).not.toContain("notifyMany(");
    expect(fn).toContain("if (!caller.isAdmin)");
    expect(sql).toContain("'admin_broadcast_sent'");
  });

  it("defaults mass communication and WhatsApp tests to non-sending previews", () => {
    const broadcast = read("src/components/admin/AdminBroadcast.tsx");
    const whatsapp = read("src/components/admin/AdminWhatsApp.tsx");
    expect(broadcast).toContain("useState(true)");
    expect(broadcast).toContain("dry_run: true");
    expect(whatsapp).toContain("testPreviewOnly, setTestPreviewOnly] = useState(true)");
    expect(whatsapp.indexOf("if (testPreviewOnly)")).toBeLessThan(whatsapp.indexOf('functions.invoke("send-whatsapp"'));
  });

  it("enforces opt-out, internal links and recipient masking", () => {
    const fn = read("supabase/functions/admin-broadcast/index.ts");
    const templates = read("src/components/admin/AdminNotificationTemplates.tsx");
    expect(fn).toContain("prefs.announcement === false");
    expect(fn).toContain('link.startsWith("//")');
    expect(templates).toContain("maskRecipient(l.recipient)");
  });

  it("rate limits fail closed, paginates and delivers atomically with idempotency", () => {
    const fn = read("supabase/functions/admin-broadcast/index.ts");
    const sql = read("supabase/migrations/20260820200000_admin_broadcast_atomic.sql");
    expect(fn).toContain('"admin-broadcast", 3, 60, true');
    expect(fn).toContain("Recent authentication required");
    expect(fn).toContain(".range(from, to)");
    expect(sql).toContain("idempotency_key uuid NOT NULL UNIQUE");
    expect(sql).toContain("fn_admin_broadcast_deliver");
    expect(sql).toContain("uq_notifications_broadcast_user");
  });
});
