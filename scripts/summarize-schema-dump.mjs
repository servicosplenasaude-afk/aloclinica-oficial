#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node scripts/summarize-schema-dump.mjs <schema.sql> <summary.json>");
  process.exit(2);
}

const sql = readFileSync(input, "utf8");
if (!sql.trim()) {
  console.error("Schema dump is empty.");
  process.exit(2);
}

const forbiddenSecrets = [
  /\bcfut_[A-Za-z0-9_-]{30,}\b/,
  /\bsbp_[A-Za-z0-9_-]{30,}\b/,
  /\b(?:sk_live_|sk_test_)[A-Za-z0-9_-]{16,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
if (forbiddenSecrets.some((pattern) => pattern.test(sql))) {
  console.error("Schema evidence contains a credential-like value; refusing to publish it.");
  process.exit(1);
}

const count = (pattern) => [...sql.matchAll(pattern)].length;
const summary = {
  format: "aloclinica-schema-summary-v1",
  sha256: createHash("sha256").update(sql).digest("hex"),
  bytes: Buffer.byteLength(sql),
  objects: {
    tables: count(/^CREATE TABLE\s/gim),
    functions: count(/^CREATE (?:OR REPLACE )?FUNCTION\s/gim),
    views: count(/^CREATE (?:OR REPLACE )?VIEW\s/gim),
    policies: count(/^CREATE POLICY\s/gim),
    triggers: count(/^CREATE TRIGGER\s/gim),
    indexes: count(/^CREATE (?:UNIQUE )?INDEX\s/gim),
    types: count(/^CREATE TYPE\s/gim),
  },
};

writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary));
