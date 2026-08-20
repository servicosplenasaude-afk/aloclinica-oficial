import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin compliance scale contracts", () => {
  it("does not silently cap logs at 1000 and publishes the export ceiling", () => {
    const source = read("src/components/admin/AdminLogs.tsx");
    expect(source).not.toContain(".limit(1000)");
    expect(source).toContain("EXPORT_LIMIT = 50_000");
    expect(source).toContain("collectServerPages");
    expect(source).toContain("CSV (máx. 50 mil)");
  });

  it("pages all compliance datasets and exposes view/export ceilings", () => {
    const source = read("src/components/admin/AdminCompliance.tsx");
    expect(source).not.toContain(".limit(1000)");
    expect(source).toContain("COMPLIANCE_VIEW_LIMIT = 5_000");
    expect(source).toContain("COMPLIANCE_EXPORT_LIMIT = 50_000");
    expect(source).toContain("loadComplianceView");
    expect(source).toContain("Visualização: máx. 5.000/aba");
  });
});
