import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SEGURANÇA (C6): rate-limit por IP para impedir adivinhação de token em massa.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const allowed = await checkRateLimit(`ip:${ip}`, "guest-consultation", 30, 10);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // Find appointment by access_token
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select("*")
      .eq("access_token", token)
      .single();

    if (aptError || !appointment) {
      return new Response(JSON.stringify({ error: "Consultation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get guest patient info
    let guestPatient = null;
    if (appointment.guest_patient_id) {
      const { data } = await supabase
        .from("guest_patients")
        .select("*")
        .eq("id", appointment.guest_patient_id)
        .single();
      guestPatient = data;
      // Minimização de dados (C6/LGPD): não devolver CPF na resposta — a tela de
      // entrar na consulta não precisa dele.
      if (guestPatient && "cpf" in guestPatient) delete (guestPatient as Record<string, unknown>).cpf;
    }

    // Get doctor name
    let doctorName = "Médico";
    const { data: docProfile } = await supabase
      .from("doctor_profiles")
      .select("user_id")
      .eq("id", appointment.doctor_id)
      .single();

    if (docProfile) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", docProfile.user_id)
        .single();
      if (profile) doctorName = `Dr(a). ${profile.first_name} ${profile.last_name}`;
    }

    return new Response(
      JSON.stringify({ appointment, guest_patient: guestPatient, doctor_name: doctorName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
