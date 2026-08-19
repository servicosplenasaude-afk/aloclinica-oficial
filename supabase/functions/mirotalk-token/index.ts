import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCaller } from "../_shared/auth.ts";
import { expectedMirotalkRoom, isVideoAccessWindowOpen } from "../_shared/video-access.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const caller = await getCaller(req);
    if (!caller.user) return json({ error: "Unauthorized" }, 401);

    const { appointmentId, room, name } = await req.json().catch(() => ({}));
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(appointmentId ?? "") || !room || typeof room !== "string") {
      return json({ error: "Invalid request" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: appointment, error } = await admin.from("appointments")
      .select("id,status,scheduled_at,duration_minutes,patient_id,doctor_id,video_room_secret")
      .eq("id", appointmentId).maybeSingle();
    if (error || !appointment) return json({ error: "Appointment not found" }, 404);

    let role: "patient" | "doctor" | null = appointment.patient_id === caller.user.id ? "patient" : null;
    if (!role && appointment.doctor_id) {
      const { data: doctor } = await admin.from("doctor_profiles").select("id")
        .eq("id", appointment.doctor_id).eq("user_id", caller.user.id).maybeSingle();
      if (doctor) role = "doctor";
    }
    if (!role) return json({ error: "Forbidden" }, 403);
    if (!isVideoAccessWindowOpen(appointment)) return json({ error: "Appointment outside access window" }, 403);
    const expectedRoom = expectedMirotalkRoom(appointment);
    if (!expectedRoom || room !== expectedRoom) return json({ error: "Invalid room" }, 403);

    const base = (Deno.env.get("MIROTALK_URL") || "https://meet.telemedicinaaloclinica.sbs").replace(/\/+$/, "");
    const apiKey = Deno.env.get("MIROTALK_API_KEY");
    if (!apiKey) return json({ error: "Video service unavailable" }, 503);

    try {
      const response = await fetch(`${base}/api/v1/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: apiKey },
        body: JSON.stringify({
          username: (name || caller.user.email || "user").slice(0, 60),
          password: "",
          presenter: role === "doctor" ? "true" : "false",
          expire: "3h",
        }),
      });
      if (!response.ok) return json({ error: "Video service unavailable" }, 502);
      const data = await response.json().catch(() => ({}));
      const token = (data as { token?: string }).token;
      return token ? json({ token }) : json({ error: "Video service unavailable" }, 502);
    } catch {
      return json({ error: "Video service unavailable" }, 502);
    }
  } catch (error) {
    console.error("[mirotalk-token]", error);
    return json({ error: "Internal server error" }, 500);
  }
});
