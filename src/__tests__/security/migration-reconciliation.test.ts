import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const dirs: string[] = [];
const script = resolve("scripts/verify-migration-reconciliation.mjs");

function fixture(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "aloclinica-migrations-"));
  dirs.push(dir);
  const file = join(dir, "list.txt");
  writeFileSync(file, contents);
  return file;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("migration reconciliation CLI", () => {
  it("accepts matching local and remote versions", () => {
    const file = fixture("| Local | Remote | Time |\n| 20260819000100 | 20260819000100 | x |\n");
    const output = execFileSync(process.execPath, [script, file], { encoding: "utf8" });
    expect(output).toContain("1 versions match");
  });

  it("accepts the JSON emitted by Supabase CLI in non-interactive runners", () => {
    const file = fixture(JSON.stringify({ migrations: [
      { local: "20260819000100", remote: "20260819000100" },
    ] }));
    const output = execFileSync(process.execPath, [script, file], { encoding: "utf8" });
    expect(output).toContain("1 versions match");
  });

  it("fails closed for a local-only migration", () => {
    const file = fixture("| Local | Remote | Time |\n| 20260819000100 |                | x |\n");
    const result = spawnSync(process.execPath, [script, file], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("local_only=1");
  });

  it("fails closed when CLI output cannot be parsed", () => {
    const file = fixture("permission denied");
    const result = spawnSync(process.execPath, [script, file], { encoding: "utf8" });
    expect(result.status).toBe(2);
  });
});
