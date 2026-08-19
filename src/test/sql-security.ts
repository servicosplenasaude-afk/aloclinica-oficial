import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readMigration(name: string): string {
  return normalizeSql(
    readFileSync(resolve(process.cwd(), "supabase", "migrations", name), "utf8"),
  );
}

export function normalizeSql(sql: string): string {
  return sql
    .replace(/--.*$/gm, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function expectSqlContract(sql: string, fragments: readonly string[]): void {
  for (const fragment of fragments) {
    const normalizedFragment = normalizeSql(fragment);
    if (!sql.includes(normalizedFragment)) {
      throw new Error(`Missing SQL security contract: ${fragment}`);
    }
  }
}
