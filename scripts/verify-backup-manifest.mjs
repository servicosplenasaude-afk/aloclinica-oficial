#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";

const manifestArg = process.argv[2];
if (!manifestArg) {
  console.error("Usage: node scripts/verify-backup-manifest.mjs <manifest.json>");
  process.exit(2);
}

const manifestPath = resolve(manifestArg);
const root = dirname(manifestPath);
const requiredTables = [
  "profiles", "doctor_profiles", "appointments", "prescriptions",
  "exam_requests", "exam_reports", "medical_records", "subscriptions", "doctor_payouts",
];

function safePath(filePath) {
  const normalized = String(filePath).replace(/^snapshots[\\/][^\\/]+[\\/]/, "");
  const candidate = resolve(root, normalized);
  const rel = relative(root, candidate);
  if (isAbsolute(rel) || rel.startsWith("..")) throw new Error(`unsafe manifest path: ${filePath}`);
  return candidate;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest?.format !== "aloclinica-operational-export-v2" || !manifest?.tables) {
  throw new Error("unsupported or incomplete backup manifest");
}
if (!manifest.created_at || Number.isNaN(Date.parse(manifest.created_at))) {
  throw new Error("invalid backup creation timestamp");
}
for (const table of requiredTables) {
  if (!(table in manifest.tables)) throw new Error(`missing required table: ${table}`);
}

let filesChecked = 0;
let rowsChecked = 0;
const seenPaths = new Set();
for (const [table, entry] of Object.entries(manifest.tables)) {
  if (!entry || !Array.isArray(entry.files) || !Number.isSafeInteger(entry.rows) || entry.rows < 0) {
    throw new Error(`invalid table manifest: ${table}`);
  }
  let tableRows = 0;
  for (const file of entry.files) {
    if (!file?.path || !/^[a-f0-9]{64}$/i.test(file.sha256 ?? "") || !Number.isSafeInteger(file.rows) || file.rows < 0) {
      throw new Error(`invalid file entry: ${table}`);
    }
    const localPath = safePath(file.path);
    if (seenPaths.has(localPath)) throw new Error(`duplicate file path: ${table}`);
    seenPaths.add(localPath);
    await stat(localPath);
    const contents = await readFile(localPath);
    const checksum = createHash("sha256").update(contents).digest("hex");
    if (checksum !== file.sha256.toLowerCase()) throw new Error(`checksum mismatch: ${table}`);
    const rows = JSON.parse(contents.toString("utf8"));
    if (!Array.isArray(rows) || rows.length !== file.rows) throw new Error(`row count mismatch: ${table}`);
    tableRows += rows.length;
    filesChecked += 1;
  }
  if (tableRows !== entry.rows) throw new Error(`table row count mismatch: ${table}`);
  rowsChecked += tableRows;
}

console.log(`Backup manifest verified: tables=${Object.keys(manifest.tables).length} files=${filesChecked} rows=${rowsChecked}`);
