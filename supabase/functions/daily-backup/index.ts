import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isInternalOrService } from "../_shared/auth.ts";

const TABLES = [
  "profiles", "doctor_profiles", "appointments", "prescriptions",
  "exam_requests", "exam_reports", "medical_records", "subscriptions",
  "doctor_payouts",
];
const PAGE_SIZE = 1000;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (!isInternalOrService(req)) return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const runId = new Date().toISOString().replaceAll(":", "-");
  const prefix = `snapshots/${runId}`;
  const manifest: Record<string, unknown> = {
    format: "aloclinica-operational-export-v2",
    created_at: new Date().toISOString(),
    page_size: PAGE_SIZE,
    tables: {},
  };

  try {
    const { data: bucket } = await supabase.storage.getBucket("backups");
    if (!bucket) {
      const { error } = await supabase.storage.createBucket("backups", { public: false });
      if (error) throw new Error("backup bucket unavailable");
    }

    for (const table of TABLES) {
      let page = 0;
      let rowCount = 0;
      const files: Array<{ path: string; rows: number; sha256: string }> = [];
      while (true) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase.from(table).select("*").order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(`read failed: ${table}`);
        const rows = data ?? [];
        if (rows.length === 0) break;
        const json = JSON.stringify(rows);
        const path = `${prefix}/${table}/${String(page).padStart(6, "0")}.json`;
        const checksum = await sha256(json);
        const { error: uploadError } = await supabase.storage.from("backups").upload(
          path, new Blob([json], { type: "application/json" }), { upsert: false },
        );
        if (uploadError) throw new Error(`upload failed: ${table}/${page}`);
        files.push({ path, rows: rows.length, sha256: checksum });
        rowCount += rows.length;
        page += 1;
        if (rows.length < PAGE_SIZE) break;
      }
      (manifest.tables as Record<string, unknown>)[table] = { rows: rowCount, files };
    }

    const manifestJson = JSON.stringify(manifest, null, 2);
    const { error: manifestError } = await supabase.storage.from("backups").upload(
      `${prefix}/manifest.json`, new Blob([manifestJson], { type: "application/json" }), { upsert: false },
    );
    if (manifestError) throw new Error("manifest upload failed");

    await supabase.from("activity_logs").insert({
      action: "daily_backup_run", entity_type: "system",
      details: { run_id: runId, status: "completed", manifest: `${prefix}/manifest.json` },
    });
    return new Response(JSON.stringify({ ok: true, run_id: runId, manifest: `${prefix}/manifest.json` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[daily-backup] operational export failed", error instanceof Error ? error.message : "unknown");
    await supabase.from("activity_logs").insert({
      action: "daily_backup_run", entity_type: "system", details: { run_id: runId, status: "failed" },
    });
    return new Response(JSON.stringify({ error: "Backup failed", run_id: runId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
