import { describe, expect, it } from "vitest";
import { getBackupState, shortRelease, type OperationalHealth } from "@/lib/admin-system-health";

const base = (overrides: Partial<OperationalHealth["backup"]> = {}): OperationalHealth => ({
  environment: "production", release: "abcdef1234567890", projectRef: "project",
  storage: { bucketCount: 8, status: "ok" },
  backup: {
    status: "completed",
    latestRun: { status: "completed", occurredAt: "2026-08-20T00:00:00.000Z", runId: "run" },
    lastCompleted: { status: "completed", occurredAt: "2026-08-20T00:00:00.000Z", runId: "run" },
    ...overrides,
  },
});

describe("admin system health", () => {
  it("classifies a recent successful backup as healthy", () => {
    expect(getBackupState(base(), Date.parse("2026-08-20T12:00:00.000Z"))).toBe("healthy");
  });

  it("flags a latest failed run even when an older backup succeeded", () => {
    expect(getBackupState(base({ latestRun: { status: "failed", occurredAt: "2026-08-20T10:00:00.000Z", runId: "failed" } }))).toBe("failed");
  });

  it("flags backups older than 36 hours", () => {
    expect(getBackupState(base(), Date.parse("2026-08-22T00:00:01.000Z"))).toBe("stale");
  });

  it("does not expose a full release identifier in the UI", () => {
    expect(shortRelease("abcdef1234567890")).toBe("abcdef123456");
    expect(shortRelease(null)).toBe("Não informado");
  });
});
