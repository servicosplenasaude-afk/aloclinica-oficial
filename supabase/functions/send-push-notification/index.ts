import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "https://esm.sh/web-push@3.6.7";
import { getCaller, isInternalOrService, checkRateLimit } from "../_shared/auth.ts";

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
    // Internal/service calls bypass limits; otherwise require an authenticated
    // user and rate-limit to curb push spam to arbitrary user_ids.
    const internal = isInternalOrService(req);
    let caller: Awaited<ReturnType<typeof getCaller>> | null = null;
    if (!internal) {
      caller = await getCaller(req);
      if (!caller.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!caller.isAdmin) {
        const allowed = await checkRateLimit(`user:${caller.user.id}`, "send-push-notification", 60, 10);
        if (!allowed) {
          return new Response(JSON.stringify({ error: "Muitas notificações. Aguarde." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
          });
        }
      }
    }

    const { user_id, title, message, link, appointment_id, type = "push" } = await req.json();

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: "user_id, title, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Usuários comuns podem notificar a si mesmos ou o outro participante de uma
    // consulta da qual realmente fazem parte. O appointment é validado no servidor.
    if (!internal && caller && !caller.isAdmin && user_id !== caller.user!.id) {
      if (!appointment_id) {
        return new Response(JSON.stringify({ error: "Sem permissão para notificar este usuário." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: appointment } = await supabase
        .from("appointments")
        .select("patient_id, doctor_id")
        .eq("id", appointment_id)
        .maybeSingle();
      const { data: doctor } = appointment?.doctor_id
        ? await supabase.from("doctor_profiles").select("user_id").eq("id", appointment.doctor_id).maybeSingle()
        : { data: null };
      const participants = [appointment?.patient_id, doctor?.user_id].filter(Boolean);
      if (!participants.includes(caller.user!.id) || !participants.includes(user_id)) {
        return new Response(JSON.stringify({ error: "Sem permissão para esta consulta." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id, title, message, link, type,
    });
    if (notificationError) throw notificationError;

    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");
    if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY || !VAPID_SUBJECT) {
      return new Response(JSON.stringify({ success: true, sent: 0, in_app: true, reason: "Push não configurado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError || !subscriptions?.length) {
      console.info("No push subscriptions found for user:", user_id);
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: link || "/",
      icon: "/favicon-v2.png",
      badge: "/favicon-v2.png",
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.sendNotification(pushSubscription, payload, {
          TTL: 86400,
          urgency: "high",
        });
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        console.error(`Push failed for ${sub.endpoint}:`, statusCode || (err instanceof Error ? err.message : "unknown"));
        failed++;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          console.info("Removed expired subscription:", sub.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
