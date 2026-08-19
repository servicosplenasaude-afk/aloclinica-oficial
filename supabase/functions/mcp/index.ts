import { createSupabaseHandler } from "npm:@lovable.dev/mcp-js@0.20.1/stacks/supabase";
import mcp from "./mcp.ts";

Deno.serve(createSupabaseHandler(mcp, { functionName: "mcp" }));
