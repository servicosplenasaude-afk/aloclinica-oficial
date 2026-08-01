// Lovable AI Gateway helper — OpenAI-compatible streaming.
// Used as the primary (and fallback) AI provider for chat features.

export const DEFAULT_AI_MODEL = "google/gemini-3.6-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamAIOptions {
  model?: string;
  system?: string;
  messages: AIMessage[];
  temperature?: number;
  max_tokens?: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Streams an OpenAI-shaped SSE response from the Lovable AI Gateway. */
export async function streamLovableAI(opts: StreamAIOptions): Promise<Response> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    const err: any = new Error("LOVABLE_API_KEY não configurada");
    err.status = 500;
    throw err;
  }

  const messages: AIMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  for (const m of opts.messages) {
    if (!m?.content) continue;
    messages.push({ role: m.role, content: typeof m.content === "string" ? m.content : String(m.content) });
  }

  const upstream = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model || DEFAULT_AI_MODEL,
      messages,
      stream: true,
      ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
      ...(opts.max_tokens ? { max_tokens: opts.max_tokens } : {}),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error("Lovable AI gateway error:", upstream.status, errText);
    const err: any = new Error(`Lovable AI error: ${upstream.status}`);
    err.status = upstream.status;
    err.body = errText;
    throw err;
  }

  return new Response(upstream.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
