import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MEMED_API_URL = "https://integrations.api.memed.com.br/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MEMED_API_KEY = Deno.env.get("MEMED_API_KEY");
    const MEMED_SECRET_KEY = Deno.env.get("MEMED_SECRET_KEY");

    if (!MEMED_API_KEY || !MEMED_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: "Memed keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claims.claims.sub as string;

    // Get doctor profile and user profile
    const { data: doctorProfile } = await supabase
      .from("doctor_profiles")
      .select("id, crm, crm_state, user_id")
      .eq("user_id", userId)
      .single();

    if (!doctorProfile) {
      return new Response(
        JSON.stringify({ error: "Doctor profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, cpf, phone, date_of_birth")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the prescriber's medical specialty (required by Memed certification).
    // doctor_specialties -> specialties(name). A doctor may have several; Memed
    // registers a single "especialidade", so we take the first. Fallback keeps
    // registration from failing when the profile has no specialty linked yet.
    let especialidade = "Clínico Geral";
    const { data: specialtyRows } = await supabase
      .from("doctor_specialties")
      .select("specialties(name)")
      .eq("doctor_id", doctorProfile.id)
      .limit(1);
    const specialtyName = specialtyRows?.[0]?.specialties?.[0]?.name;
    if (specialtyName) especialidade = specialtyName;

    // Try to get existing user from Memed first.
    // FIX: the identifier goes in the PATH (/usuarios/{external_id}), NOT a
    // ?filter[] query — that route/method combo returns 403 "Método inválido
    // para a rota informada" (per Memed docs, GET /sinapse-prescricao/usuarios/{ID}).
    // Also only parse JSON on a 2xx: a 404 (new user) returns a non-JSON body.
    const getUrl = `${MEMED_API_URL}/sinapse-prescricao/usuarios/${encodeURIComponent(userId)}?api-key=${MEMED_API_KEY}&secret-key=${MEMED_SECRET_KEY}`;

    const getRes = await fetch(getUrl, {
      headers: { "Accept": "application/vnd.api+json" },
    });

    // If user exists, return their token
    if (getRes.ok) {
      const getData = await getRes.json().catch(() => null);
      const memedToken = getData?.data?.attributes?.token;
      if (memedToken) {
        console.info("Memed user found, returning existing token");
        return new Response(
          JSON.stringify({ token: memedToken, status: "existing" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Register new user on Memed
    console.info("Registering new prescriber on Memed...");

    const dobFormatted = profile.date_of_birth
      ? new Date(profile.date_of_birth).toLocaleDateString("pt-BR")
      : "01/01/1980";

    const registerPayload = {
      data: {
        type: "usuarios",
        attributes: {
          external_id: userId,
          nome: profile.first_name,
          sobrenome: profile.last_name,
          cpf: (profile.cpf || "").replace(/\D/g, ""),
          board: {
            board_code: "CRM",
            board_number: doctorProfile.crm.replace(/\D/g, ""),
            board_state: doctorProfile.crm_state || "SP",
          },
          email: claims.claims.email || "",
          telefone: (profile.phone || "").replace(/\D/g, ""),
          data_nascimento: dobFormatted,
          especialidade,
        },
      },
    };

    const registerUrl = `${MEMED_API_URL}/sinapse-prescricao/usuarios?api-key=${MEMED_API_KEY}&secret-key=${MEMED_SECRET_KEY}`;

    const registerRes = await fetch(registerUrl, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerPayload),
    });

    const registerData = await registerRes.json();

    if (!registerRes.ok) {
      console.error("Memed registration error:", JSON.stringify(registerData));
      return new Response(
        JSON.stringify({
          error: "Failed to register prescriber on Memed",
          details: registerData.errors || registerData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const memedToken = registerData?.data?.attributes?.token;

    if (!memedToken) {
      console.error("No token in Memed response:", JSON.stringify(registerData));
      return new Response(
        JSON.stringify({ error: "Token not returned from Memed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.info("Memed prescriber registered successfully");

    return new Response(
      JSON.stringify({ token: memedToken, status: "created" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
