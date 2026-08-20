import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin health contracts", () => {
  it("authorizes an administrator before querying operational metadata", () => {
    const source = read("supabase/functions/service-health/index.ts");
    const adminGuard = source.indexOf('if (!caller.isAdmin) return json({ error: "acesso restrito a administradores" }, 403)');
    const operationalQuery = source.indexOf('svc.storage.listBuckets()');
    expect(adminGuard).toBeGreaterThan(-1);
    expect(operationalQuery).toBeGreaterThan(adminGuard);
  });

  it("returns only allow-listed backup fields instead of raw activity logs", () => {
    const source = read("supabase/functions/service-health/index.ts");
    expect(source).toContain('.select("created_at, details")');
    expect(source).not.toContain('select("*")');
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY:");
  });

  it("publishes environment and release metadata for both deployment targets", () => {
    const production = read(".github/workflows/deploy.yml");
    const sandbox = read(".github/workflows/deploy-staging.yml");
    expect(production).toContain('APP_ENV=production APP_RELEASE="$GITHUB_SHA"');
    expect(sandbox).toContain('APP_ENV=sandbox APP_RELEASE="$GITHUB_SHA"');
  });
});
