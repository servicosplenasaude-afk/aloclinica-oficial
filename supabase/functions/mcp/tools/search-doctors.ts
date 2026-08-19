import { defineTool } from "npm:@lovable.dev/mcp-js@0.20.1";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

export default defineTool({
  name: "search_doctors",
  title: "Search approved doctors",
  description:
    "Search AloClínica's directory of approved, publicly-listed doctors. Filter by specialty slug and/or a name substring. Returns only public profile fields (never contact info or private data).",
  inputSchema: {
    specialty: z.string().trim().optional().describe(
      "Optional specialty slug (e.g. 'cardiologia'). Use list_specialties to discover valid slugs.",
    ),
    name: z.string().trim().optional().describe(
      "Optional case-insensitive substring to match doctor display name.",
    ),
    limit: z.number().int().min(1).max(50).optional().describe(
      "Max results (default 10, max 50).",
    ),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ specialty, name, limit }) => {
    const sb = createPublicClient();
    let query = sb
      .from("doctor_profiles")
      .select("user_id, display_name, specialty, crm, uf, bio, avatar_url, price_cents, is_active, approval_status")
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .limit(limit ?? 10);

    if (specialty) query = query.eq("specialty", specialty);
    if (name) query = query.ilike("display_name", `%${name}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { doctors: data ?? [] },
    };
  },
});

function createPublicClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL and a public Supabase key must be configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
