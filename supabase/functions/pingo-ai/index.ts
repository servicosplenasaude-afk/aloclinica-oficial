Deno.serve(() => new Response(JSON.stringify({ ok: true, build: "v2" }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }));
