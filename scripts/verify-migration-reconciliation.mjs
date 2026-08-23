#!/usr/bin/env node
import { readFileSync } from "node:fs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/verify-migration-reconciliation.mjs <migration-list-output>");
  process.exit(2);
}

const text = readFileSync(input, "utf8");
let rows = [];
let parsedJson = false;
try {
  const parsed = JSON.parse(text);
  const migrations = Array.isArray(parsed) ? parsed : parsed?.migrations;
  if (Array.isArray(migrations)) {
    parsedJson = true;
    rows = migrations.map((row) => ({
      local: row?.local ? String(row.local) : null,
      remote: row?.remote ? String(row.remote) : null,
    }));
  }
} catch {
  // Human-readable CLI output is parsed below.
}
for (const line of text.split(/\r?\n/)) {
  // Recent Supabase CLI versions wrap table values in Markdown-style
  // backticks, while older versions emitted plain digits.
  const normalized = line.replaceAll("`", "");
  const cells = normalized.split("|").map((cell) => cell.trim());
  const trimmed = normalized.trim();
  const offset = trimmed.startsWith("|") && trimmed.endsWith("|") ? 1 : 0;
  const local = /^\d{8,14}$/.test(cells[offset] ?? "") ? cells[offset] : null;
  const remote = /^\d{8,14}$/.test(cells[offset + 1] ?? "") ? cells[offset + 1] : null;
  if (!local && !remote) continue;
  if (!parsedJson) rows.push({ local, remote });
}
if (rows.length === 0) {
  console.error("Migration reconciliation failed: no migration rows were parsed.");
  process.exit(2);
}

const localOnly = rows.filter((row) => row.local && !row.remote).map((row) => row.local);
const remoteOnly = rows.filter((row) => !row.local && row.remote).map((row) => row.remote);
const mismatched = rows.filter((row) => row.local && row.remote && row.local !== row.remote);
if (localOnly.length || remoteOnly.length || mismatched.length) {
  console.error(`Migration divergence: local_only=${localOnly.length} remote_only=${remoteOnly.length} mismatched=${mismatched.length}`);
  const summarize = (versions) => `${versions.slice(0, 20).join(", ")}${versions.length > 20 ? ` … (+${versions.length - 20})` : ""}`;
  if (localOnly.length) console.error(`Local only: ${summarize(localOnly)}`);
  if (remoteOnly.length) console.error(`Remote only: ${summarize(remoteOnly)}`);
  process.exit(1);
}
console.log(`Migration reconciliation passed: ${rows.length} versions match.`);
