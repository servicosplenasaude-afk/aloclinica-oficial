import { describe, expect, it } from "vitest";
import { buildHealthReport, filterDiagnostics, healthReportText, type DiagnosticItem } from "@/lib/admin-health-report";

const items: DiagnosticItem[] = [
  { key: "db", label: "Banco", status: "ok", latencyMs: 20, source: "core", critical: true },
  { key: "mail", label: "E-mail", status: "down", detail: "Sem resposta", source: "external" },
  { key: "nfse", label: "NFS-e", status: "unconfigured", source: "external" },
];

describe("admin health report", () => {
  it("filtra incidentes e serviços não configurados", () => {
    expect(filterDiagnostics(items, "attention").map((item) => item.key)).toEqual(["mail"]);
    expect(filterDiagnostics(items, "unconfigured").map((item) => item.key)).toEqual(["nfse"]);
  });

  it("gera relatório estável sem campos secretos", () => {
    const report = buildHealthReport({ checkedAt: "2026-08-23T00:00:00Z", environment: "production", release: "abc", items });
    expect(report.totals).toEqual({ total: 3, operational: 1, attention: 1, unconfigured: 1 });
    expect(JSON.stringify(report)).not.toMatch(/token|secret|authorization/i);
    expect(healthReportText(report)).toContain("1/3 operacionais");
  });

  it("remove credenciais de detalhes exportados", () => {
    const report = buildHealthReport({
      checkedAt: "2026-08-23T00:00:00Z", environment: "production", release: "abc",
      items: [{ key: "api", label: "API", status: "down", source: "external", detail: "Bearer abc.def?token=segredo cfut_123456" }],
    });
    expect(JSON.stringify(report)).not.toContain("abc.def");
    expect(JSON.stringify(report)).not.toContain("segredo");
    expect(JSON.stringify(report)).not.toContain("cfut_123456");
  });
});
