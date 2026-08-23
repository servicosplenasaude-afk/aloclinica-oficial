import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

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
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    let q = sb.from("medical_specialties").select("name, slug, description, is_active").eq("is_active", true).order("name");
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { specialties: data ?? [] },
    };
  },
});
