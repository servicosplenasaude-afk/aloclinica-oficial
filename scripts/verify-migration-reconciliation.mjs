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
  const match = line.match(/^\s*\|\s*(\d{8,14})?\s*\|\s*(\d{8,14})?\s*\|/);
  if (!match || (!match[1] && !match[2])) continue;
  if (!parsedJson) rows.push({ local: match[1] ?? null, remote: match[2] ?? null });
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
  if (localOnly.length) console.error(`Local only: ${localOnly.join(", ")}`);
  if (remoteOnly.length) console.error(`Remote only: ${remoteOnly.join(", ")}`);
  process.exit(1);
}
console.log(`Migration reconciliation passed: ${rows.length} versions match.`);
