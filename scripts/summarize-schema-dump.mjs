#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const [input, output, redactedOutput] = process.argv.slice(2);
if (!input || !output || !redactedOutput) {
  console.error("Usage: node scripts/summarize-schema-dump.mjs <schema.sql> <summary.json> <redacted-schema.sql>");
  process.exit(2);
}

const sql = readFileSync(input, "utf8");
if (!sql.trim()) {
  console.error("Schema dump is empty.");
  process.exit(2);
}

const forbiddenSecrets = [
  ["cloudflare_token", /\bcfut_[A-Za-z0-9_-]{30,}\b/g],
  ["supabase_token", /\bsbp_[A-Za-z0-9_-]{30,}\b/g],
  ["payment_secret", /\b(?:sk_live_|sk_test_)[A-Za-z0-9_-]{16,}\b/g],
  ["jwt", /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g],
  ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];
const redactions = {};
let redactedSql = sql;
for (const [label, pattern] of forbiddenSecrets) {
  let matches = 0;
  redactedSql = redactedSql.replace(pattern, () => {
    matches += 1;
    return `[REDACTED_${label.toUpperCase()}]`;
  });
  if (matches) redactions[label] = matches;
}

const count = (pattern) => [...sql.matchAll(pattern)].length;
const summary = {
  format: "aloclinica-schema-summary-v1",
  sha256: createHash("sha256").update(sql).digest("hex"),
  bytes: Buffer.byteLength(sql),
  redactions,
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
writeFileSync(redactedOutput, redactedSql, "utf8");
console.log(JSON.stringify(summary));
