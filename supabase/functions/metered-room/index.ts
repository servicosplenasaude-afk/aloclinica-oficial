import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// SECURITY: authenticate + authorize the caller before minting a joinable room.
import { getCaller } from "../_shared/auth.ts";
import { isVideoAccessWindowOpen } from "../_shared/video-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // SECURITY: require an authenticated caller (401 if none).
    const caller = await getCaller(req);
    if (!caller.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { appointmentId } = await req.json();

    // Input validation
    if (!appointmentId || typeof appointmentId !== "string" || appointmentId.length > 50) {
      return new Response(JSON.stringify({ error: "Invalid appointmentId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(appointmentId)) {
      return new Response(JSON.stringify({ error: "Invalid appointment ID format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify appointment exists and is active
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SECURITY: load ownership columns so we can authorize the caller.
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, status, patient_id, doctor_id, scheduled_at, duration_minutes")
      .eq("id", appointmentId)
      .in("status", ["confirmed", "in_progress", "scheduled"])
      .maybeSingle();

    if (!appt) {
      return new Response(JSON.stringify({ error: "Appointment not found or not active" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isVideoAccessWindowOpen(appt)) {
      return new Response(JSON.stringify({ error: "Appointment outside access window" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: caller must be the appointment's patient OR its doctor, else 403.
    let authorized = (appt as any).patient_id === caller.user.id;
    if (!authorized && (appt as any).doctor_id) {
      const { data: docProfile } = await supabase
        .from("doctor_profiles")
        .select("id")
        .eq("user_id", caller.user.id)
        .eq("id", (appt as any).doctor_id)
        .maybeSingle();
      authorized = !!docProfile;
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Not authorized for this appointment" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appName = Deno.env.get("METERED_APP_NAME");
    const secretKey = Deno.env.get("METERED_SECRET_KEY");

    if (!appName || !secretKey) {
      return new Response(JSON.stringify({ error: "Metered credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanAppName = appName.replace(/\.metered\.live$/i, "");
    const meteredDomain = `${cleanAppName}.metered.live`;
    const roomName = `consulta-${appointmentId.replace(/-/g, "").slice(0, 16)}`;

    // Try to get existing room first
    const getRes = await fetch(
      `https://${meteredDomain}/api/v1/room/${roomName}?secretKey=${secretKey}`
    );

    if (getRes.ok) {
      const room = await getRes.json();
      return new Response(JSON.stringify({
        roomURL: `${meteredDomain}/${roomName}`,
        roomName: room.roomName,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create room
    const createRes = await fetch(
      `https://${meteredDomain}/api/v1/room?secretKey=${secretKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          privacy: "public",
          autoJoin: true,
          maxParticipants: 4,
          ejectAtRoomExp: true,
          expireUnixSec: Math.floor(Date.now() / 1000) + 4 * 3600,
        }),
      }
    );

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error("Metered create room error:", err);
      return new Response(JSON.stringify({ error: "Failed to create room" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const room = await createRes.json();
    return new Response(JSON.stringify({
      roomURL: `${meteredDomain}/${room.roomName}`,
      roomName: room.roomName,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
