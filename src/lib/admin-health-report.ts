export type DiagnosticStatus = "ok" | "down" | "error" | "unconfigured" | "checking";

export interface DiagnosticItem {
  key: string;
  label: string;
  status: DiagnosticStatus;
  detail?: string;
  latencyMs?: number;
  critical?: boolean;
  source: "core" | "external" | "backup";
}

export type DiagnosticFilter = "all" | "attention" | "unconfigured";

function sanitizeDetail(value?: string): string | null {
  if (!value) return null;
  return value
    .replace(/bearer\s+[a-z0-9._~-]+/gi, "Bearer [redigido]")
    .replace(/([?&](?:token|key|secret|signature|authorization)=)[^&\s]+/gi, "$1[redigido]")
    .replace(/\b(?:sbp|cfut)_[a-z0-9_-]+\b/gi, "[credencial redigida]")
    .slice(0, 500);
}

export function filterDiagnostics(items: DiagnosticItem[], filter: DiagnosticFilter): DiagnosticItem[] {
  if (filter === "attention") return items.filter((item) => item.status === "down" || item.status === "error");
  if (filter === "unconfigured") return items.filter((item) => item.status === "unconfigured");
  return items;
}

export function buildHealthReport(input: {
  checkedAt: string;
  environment: string;
  release: string;
  items: DiagnosticItem[];
}) {
  const totals = {
    total: input.items.length,
    operational: input.items.filter((item) => item.status === "ok").length,
    attention: input.items.filter((item) => item.status === "down" || item.status === "error").length,
    unconfigured: input.items.filter((item) => item.status === "unconfigured").length,
  };

  return {
    schema: "aloclinica-health-report/v1",
    checkedAt: input.checkedAt,
    environment: input.environment,
    release: input.release,
    totals,
    services: input.items.map(({ key, label, status, detail, latencyMs, critical, source }) => ({
      key, label, status, detail: sanitizeDetail(detail), latencyMs: latencyMs ?? null,
      critical: Boolean(critical), source,
    })),
  };
}

export function healthReportText(report: ReturnType<typeof buildHealthReport>): string {
  const lines = [
    "AloClínica — Relatório operacional",
    `Verificado em: ${report.checkedAt}`,
    `Ambiente: ${report.environment}`,
    `Versão: ${report.release}`,
    `Resumo: ${report.totals.operational}/${report.totals.total} operacionais; ${report.totals.attention} requerem atenção; ${report.totals.unconfigured} não configurados`,
    "",
  ];
  for (const service of report.services) {
    lines.push(`[${service.status.toUpperCase()}] ${service.label}${service.latencyMs ? ` — ${service.latencyMs}ms` : ""}${service.detail ? ` — ${service.detail}` : ""}`);
  }
  return lines.join("\n");
}
