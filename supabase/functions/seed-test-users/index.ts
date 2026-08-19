import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeEqual } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Seeding creates privileged accounts with known passwords. Disabled unless
 * ALLOW_TEST_SEED=true AND a matching SEED_SECRET is presented.
 * NEVER set ALLOW_TEST_SEED=true in production.
 */
function seedDenied(secret: unknown): Response | null {
  if (Deno.env.get("ALLOW_TEST_SEED") !== "true") {
    return new Response(JSON.stringify({ error: "Seeding disabled" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!safeEqual(typeof secret === "string" ? secret : null, Deno.env.get("SEED_SECRET"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

 import { addHours, startOfHour } from "https://esm.sh/date-fns@2.30.0";
 
const TEST_USERS = [
  { email: "paciente@teste.com", password: "Teste123!", role: "patient", first_name: "Ana", last_name: "Paciente" },
  { email: "medico@teste.com", password: "Teste123!", role: "doctor", first_name: "Carlos", last_name: "Médico" },
  { email: "clinica@teste.com", password: "Teste123!", role: "clinic", first_name: "Maria", last_name: "Clínica" },
  { email: "recepcao@teste.com", password: "Teste123!", role: "receptionist", first_name: "João", last_name: "Recepção" },
  { email: "suporte@teste.com", password: "Teste123!", role: "support", first_name: "Paula", last_name: "Suporte" },
  { email: "parceiro@teste.com", password: "Teste123!", role: "partner", first_name: "Pedro", last_name: "Parceiro" },
  { email: "afiliado@teste.com", password: "Teste123!", role: "affiliate", first_name: "Lucas", last_name: "Afiliado" },
  { email: "laudista@teste.com", password: "Teste123!", role: "laudista", first_name: "Fernanda", last_name: "Laudista" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { secret } = await req.json().catch(() => ({ secret: null }));
    const denied = seedDenied(secret);
    if (denied) return denied;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingMap = new Map((existing?.users ?? []).map((u: any) => [u.email, u]));

    const results: Record<string, unknown>[] = [];

    for (const u of TEST_USERS) {
      const existingUser = existingMap.get(u.email);

      if (existingUser) {
        const userId = (existingUser as any).id;

        const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, {
          password: u.password,
          email_confirm: true,
        });
        if (passwordError) throw passwordError;

        // Ensure profile exists
        const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
        if (!profile) {
          await supabase.from("profiles").insert({
            user_id: userId,
            first_name: u.first_name,
            last_name: u.last_name,
          });
        }

        // Ensure role exists
        const mainRole = u.role === "affiliate" ? "partner" : u.role;
        await supabase.from("user_roles").upsert({
          user_id: userId,
          role: mainRole,
        }, { onConflict: "user_id,role" });
        // Laudista also gets doctor role
        if (u.role === "laudista") {
          await supabase.from("user_roles").upsert({
            user_id: userId,
            role: "doctor",
          }, { onConflict: "user_id,role" });
        }

        // Ensure patient role also exists (default)
        await supabase.from("user_roles").upsert({
          user_id: userId,
          role: "patient",
        }, { onConflict: "user_id,role" });

        // Ensure role-specific profiles exist
        if (u.role === "doctor" || u.role === "laudista") {
          const { data: dp } = await supabase.from("doctor_profiles").select("id").eq("user_id", userId).maybeSingle();
          if (!dp) {
            await supabase.from("doctor_profiles").insert({
              user_id: userId,
              crm: u.role === "laudista" ? "654321" : "123456",
              crm_state: "SP",
              bio: u.role === "laudista" ? "Médica laudista para validação do sistema." : "Médico de teste para validação do sistema.",
              consultation_price: 89,
              is_approved: true,
              crm_verified: true,
            });
          } else {
            // Ensure approved
            await supabase.from("doctor_profiles").update({
              is_approved: true,
              crm_verified: true,
              consultation_price: 89,
              bio: u.role === "laudista" ? "Médica laudista para validação do sistema." : "Médico de teste para validação do sistema.",
            }).eq("user_id", userId);
          }
        }

        if (u.role === "clinic") {
          const { data: cp } = await supabase.from("clinic_profiles").select("id").eq("user_id", userId).maybeSingle();
          if (!cp) {
            await supabase.from("clinic_profiles").insert({
              user_id: userId, name: "Clínica Teste", cnpj: "12.345.678/0001-00", phone: "(11) 99999-0000", is_approved: true,
            });
          }
        }

        if (u.role === "partner") {
          const { data: pp } = await supabase.from("partner_profiles").select("id").eq("user_id", userId).maybeSingle();
          if (!pp) {
            await supabase.from("partner_profiles").insert({
              user_id: userId, business_name: "Farmácia Teste", partner_type: "pharmacy", cnpj: "98.765.432/0001-00", is_approved: true,
            });
          }
        }

        results.push({ email: u.email, role: u.role, status: "repaired" });
        continue;
      }

      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { first_name: u.first_name, last_name: u.last_name },
      });

      if (createError) {
        results.push({ email: u.email, role: u.role, status: "error", error: createError.message });
        continue;
      }

      const userId = newUser.user.id;

      if (u.role !== "patient") {
        const mainRole = u.role === "affiliate" ? "partner" : u.role;
        await supabase.from("user_roles").insert({ user_id: userId, role: mainRole });
        if (u.role === "laudista") {
          await supabase.from("user_roles").insert({ user_id: userId, role: "doctor" });
        }
      }

      if (u.role === "doctor" || u.role === "laudista") {
        await supabase.from("doctor_profiles").insert({
          user_id: userId,
          crm: u.role === "laudista" ? "654321" : "123456",
          crm_state: "SP",
          bio: u.role === "laudista" ? "Médica laudista para validação do sistema." : "Médico de teste para validação do sistema.",
          consultation_price: 89,
          is_approved: true,
          crm_verified: true,
        });
      }

      if (u.role === "clinic") {
        await supabase.from("clinic_profiles").insert({
          user_id: userId, name: "Clínica Teste", cnpj: "12.345.678/0001-00", phone: "(11) 99999-0000", is_approved: true,
        });
      }

      if (u.role === "partner") {
        await supabase.from("partner_profiles").insert({
          user_id: userId, business_name: "Farmácia Teste", partner_type: "pharmacy", cnpj: "98.765.432/0001-00", is_approved: true,
        });
      }

      results.push({ email: u.email, password: u.password, role: u.role, status: "created" });
    }

     // 2. Extra steps for doctor and patient to facilitate testing
     const { data: patientUser } = await supabase.auth.admin.listUsers({ perPage: 1000 });
     const patient = patientUser?.users.find(u => u.email === "paciente@teste.com");
     const doctor = patientUser?.users.find(u => u.email === "medico@teste.com");
 
     if (patient && doctor) {
       const patientId = patient.id;
       const doctorUserId = doctor.id;
       const { data: doctorProfile, error: doctorProfileError } = await supabase
         .from("doctor_profiles").select("id").eq("user_id", doctorUserId).single();
       if (doctorProfileError) throw doctorProfileError;
       const doctorId = doctorProfile.id;

       for (const verification of [
         { user_id: patientId, tipo: "paciente" },
         { user_id: doctorUserId, tipo: "medico" },
       ]) {
         const { error: deleteKycError } = await supabase
           .from("kyc_verificacoes").delete().eq("user_id", verification.user_id);
         if (deleteKycError) throw deleteKycError;
         const { error: kycError } = await supabase.from("kyc_verificacoes").insert({
           ...verification, status: "aprovado", similarity: 1,
         });
         if (kycError) throw kycError;
       }

       const { error: doctorKycError } = await supabase.from("doctor_profiles").update({
         kyc_status: "approved", is_approved: true, crm_verified: true,
       }).eq("id", doctorId);
       if (doctorKycError) throw doctorKycError;
 
       // Create availability slot for today
       const dayOfWeek = new Date().getDay();
       await supabase.from("availability_slots").upsert({
         doctor_id: doctorId,
         day_of_week: dayOfWeek,
         start_time: "09:00:00",
         end_time: "23:59:00",
         is_active: true
       }, { onConflict: "doctor_id,day_of_week,start_time" });
 
       // Create a test appointment for "now" (rounded to hour)
       const scheduledFor = startOfHour(addHours(new Date(), 1)).toISOString();

       const { error: cleanupAppointmentError } = await supabase.from("appointments").delete()
         .eq("patient_id", patientId)
         .eq("doctor_id", doctorId)
         .eq("notes", "SANDBOX_TEST_CONSULTATION")
         .in("status", ["scheduled", "confirmed", "waiting"]);
       if (cleanupAppointmentError) throw cleanupAppointmentError;
       
       const { data: appointment, error: appError } = await supabase.from("appointments").insert({
         patient_id: patientId,
         doctor_id: doctorId,
         scheduled_at: scheduledFor,
         status: "confirmed",
         payment_status: "confirmed",
         appointment_type: "first_visit",
         notes: "SANDBOX_TEST_CONSULTATION",
         duration_minutes: 30
       }).select().single();

       if (appError) throw appError;
 
       if (appointment) {
         results.push({ type: "appointment", id: appointment.id, scheduled_at: scheduledFor, status: "created" });
       }
     }
 
    return new Response(JSON.stringify({ success: true, users: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
