import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// SECURITY: derive the signer identity from the caller's JWT (anti-spoofing)
import { getCaller, isInternalOrService } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * register-signature
 * Registra uma assinatura digital ICP-Brasil concluída no banco canônico.
 * Faz upload do PDF assinado para Storage e cria registro auditável.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      document_id,
      document_type,
      related_record_id,
      patient_name,
      document_hash,
      signature_data,
      certificate_alias,
      pdf_base64,
    } = body;

    // SECURITY: the caller must be an authenticated doctor OR a trusted internal/service
    // call. Anonymous callers are rejected.
    const internal = isInternalOrService(req);
    const caller = await getCaller(req);
    if (!caller.user && !internal) {
      return new Response(
        JSON.stringify({ error: "forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: The signer's identity must NOT be trusted from the request body — that
    // let any authenticated user forge a signature attributed to any doctor. We derive
    // doctor_name/crm/cpf from the caller's own doctor_profiles/profiles rows (JWT).
    const { data: docProfile } = caller.user
      ? await supabase
          .from("doctor_profiles")
          .select("id, crm")
          .eq("user_id", caller.user.id)
          .maybeSingle()
      : { data: null };

    // A JWT caller who is not a doctor cannot register signatures.
    if (caller.user && !docProfile && !internal) {
      return new Response(
        JSON.stringify({ error: "Apenas médicos/laudistas podem registrar assinaturas" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Secondary trusted source for name/cpf (some doctors keep CPF only in profiles).
    const { data: baseProfile } = caller.user
      ? await supabase
          .from("profiles")
          .select("first_name, last_name, cpf")
          .eq("user_id", caller.user.id)
          .maybeSingle()
      : { data: null };

    // Nome/CPF vêm de profiles (doctor_profiles não guarda full_name/cpf).
    const derivedName =
      (baseProfile ? `${baseProfile.first_name ?? ""} ${baseProfile.last_name ?? ""}`.trim() : "")
      || null;

    // SECURITY: prefer the derived (trusted) identity; FALL BACK to body values only when
    // the derived value is null (e.g. CPF may be absent from the profile — a missing CPF
    // must NOT turn into a 400 and block signing).
    const doctor_name = derivedName ?? body.doctor_name ?? null;
    const doctor_crm = docProfile?.crm ?? body.doctor_crm ?? null;
    const doctor_cpf = baseProfile?.cpf ?? body.doctor_cpf ?? null;

    // Core required fields only. Doctor identity is best-effort (derived + fallback) and
    // must not block signing when e.g. CPF is missing.
    if (!document_id || !document_type || !document_hash) {
      return new Response(
        JSON.stringify({
          error: "Campos obrigatórios faltando",
          required: ["document_id", "document_type", "document_hash"],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: When a source record is referenced, verify the caller OWNS it — the
    // record's doctor must be this doctor. Prevents signing documents belonging to
    // another doctor. The owning column varies by document_type.
    if (related_record_id && docProfile) {
      const ownershipMap: Record<string, { table: string; column: string }> = {
        prescription: { table: "prescriptions", column: "doctor_id" },
        exam: { table: "exam_requests", column: "requesting_doctor_id" },
        report: { table: "exam_reports", column: "reporter_id" },
        laudo: { table: "exam_reports", column: "reporter_id" },
        certificate: { table: "medical_records", column: "doctor_id" },
      };
      const map = ownershipMap[document_type];
      if (!map) {
        return new Response(
          JSON.stringify({ error: "document_type inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: ownedRecord } = await supabase
        .from(map.table)
        .select("id")
        .eq("id", related_record_id)
        .eq(map.column, docProfile.id)
        .maybeSingle();
      if (!ownedRecord) {
        return new Response(
          JSON.stringify({ error: "Você não é o autor do documento referenciado" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Upload do PDF assinado para Storage (se fornecido)
    let storagePath: string | null = null;
    let publicUrl: string | null = null;

    if (pdf_base64) {
      try {
        const cleanBase64 = pdf_base64.replace(/^data:application\/pdf;base64,/, "");
        const bytes = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));

        storagePath = `signed/${document_type}/${document_id}.pdf`;

        const { error: uploadErr } = await supabase.storage
          .from("prescriptions")
          .upload(storagePath, bytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadErr) {
          console.error("Storage upload error:", uploadErr);
        } else {
          // SECURITY: Signed prescription PDFs are sensitive medical documents; never
          // expose a permanent public URL. Issue a short-lived signed URL (1h TTL).
          const { data: urlData } = await supabase.storage
            .from("prescriptions")
            .createSignedUrl(storagePath, 60 * 60);
          publicUrl = urlData?.signedUrl ?? null;
        }
      } catch (e) {
        console.error("PDF upload failed:", e);
      }
    }

    // Registrar assinatura
    const { data: signature, error: sigErr } = await supabase
      .from("digital_signatures")
      .insert({
        document_id,
        document_type,
        related_record_id: related_record_id || null,
        user_id: caller.user?.id ?? body.user_id ?? null,
        doctor_name,
        doctor_crm,
        doctor_cpf,
        patient_name: patient_name || null,
        document_hash,
        signature_data: signature_data || {},
        certificate_alias: certificate_alias || null,
        provider: "vidaas",
        storage_path: storagePath,
        public_url: publicUrl,
        is_valid: true,
        signed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sigErr) {
      // Se já existe, retornar conflito mas não erro
      if (sigErr.code === "23505") {
        return new Response(
          JSON.stringify({ error: "Documento já assinado", document_id }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw sigErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        verification_url: `${new URL(req.url).origin.replace("functions", "")}/validar-receita/${document_id}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("register-signature error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});