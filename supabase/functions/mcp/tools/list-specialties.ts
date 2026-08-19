import { defineTool } from "npm:@lovable.dev/mcp-js@0.20.1";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

export default defineTool({
  name: "list_specialties",
  title: "List medical specialties",
  description:
    "List the medical specialties offered on the AloClínica telemedicine platform. Returns each specialty's name, slug, and short description.",
  inputSchema: {
    search: z
      .string()
      .trim()
      .optional()
      .describe("Optional case-insensitive substring to filter specialty names."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search }) => {
    const sb = createPublicClient();
    let query = sb
      .from("medical_specialties")
      .select("name, slug, description, is_active")
      .eq("is_active", true)
      .order("name");

    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { specialties: data ?? [] },
    };
  },
});

function createPublicClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL and a public Supabase key must be configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
