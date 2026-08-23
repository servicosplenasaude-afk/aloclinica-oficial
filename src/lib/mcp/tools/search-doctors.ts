import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "search_doctors",
  title: "Search approved doctors",
  description:
    "Search AloClínica's directory of approved, publicly-listed doctors. Filter by specialty slug and/or a name substring. Returns only public profile fields (never contact info or private data).",
  inputSchema: {
    specialty: z
      .string()
      .trim()
      .optional()
      .describe("Optional specialty slug (e.g. 'cardiologia'). Use list_specialties to discover valid slugs."),
    name: z.string().trim().optional().describe("Optional case-insensitive substring to match doctor display name."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10, max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ specialty, name, limit }) => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    let q = sb
      .from("doctor_profiles")
      .select("user_id, display_name, specialty, crm, uf, bio, avatar_url, price_cents, is_active, approval_status")
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .limit(limit ?? 10);

    if (specialty) q = q.eq("specialty", specialty);
    if (name) q = q.ilike("display_name", `%${name}%`);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { doctors: data ?? [] },
    };
  },
});
