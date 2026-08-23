export type BackupState = "healthy" | "stale" | "failed" | "never" | "unavailable";
export type SystemPresentationState = "checking" | "operational" | "warning" | "error";

export interface OperationalHealth {
  environment: "production" | "sandbox" | "unknown";
  release: string | null;
  projectRef: string | null;
  storage: { bucketCount: number | null; status: "ok" | "unavailable" };
  backup: {
    status: "completed" | "failed" | "never" | "unavailable" | "unknown";
    latestRun: { status: "completed" | "failed" | "unknown"; occurredAt: string | null; runId: string | null } | null;
    lastCompleted: { status: "completed" | "failed" | "unknown"; occurredAt: string | null; runId: string | null } | null;
  };
}

const MAX_BACKUP_AGE_MS = 36 * 60 * 60 * 1000;

export function getBackupState(operational: OperationalHealth | null | undefined, now = Date.now()): BackupState {
  if (!operational || operational.backup.status === "unavailable") return "unavailable";
  if (operational.backup.latestRun?.status === "failed") return "failed";
  const completedAt = operational.backup.lastCompleted?.occurredAt;
  if (!completedAt) return "never";
  const timestamp = Date.parse(completedAt);
  if (!Number.isFinite(timestamp) || now - timestamp > MAX_BACKUP_AGE_MS) return "stale";
  return "healthy";
}

export function shortRelease(release: string | null | undefined): string {
  if (!release) return "Não informado";
  return release.length > 12 ? release.slice(0, 12) : release;
}

export function getSystemPresentationState(input: {
  running: boolean;
  coreTotal: number;
  coreErrors: number;
  externalDown: number;
  unconfigured: number;
  backupState: BackupState;
}): SystemPresentationState {
  if (input.running || input.coreTotal === 0) return "checking";
  if (input.coreErrors > 0 || input.externalDown > 0 || ["failed", "never", "stale"].includes(input.backupState)) return "error";
  if (input.unconfigured > 0 || input.backupState === "unavailable") return "warning";
  return "operational";
}
