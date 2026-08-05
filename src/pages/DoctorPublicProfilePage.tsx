import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { db } from "@/integrations/supabase/untyped";
import SEOHead from "@/components/SEOHead";
import DoctorPublicProfile from "@/components/doctor/DoctorPublicProfile";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const DoctorPublicProfilePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorMeta, setDoctorMeta] = useState<{ name: string; specialty: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const resolve = async () => {
      let doctorProfileId: string | null = null;

      // Try UUID match
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(slug)) {
        doctorProfileId = slug;
      } else {
        // The URL slug IS doctor_profiles.slug — resolve it directly.
        // resolve_doctor_slug(p_slug) returns the doctor id (string) or null.
        const { data } = await db.rpc("resolve_doctor_slug", { p_slug: slug });
        if (data) doctorProfileId = data as string;

        // Fallback: name-based search. search_doctor_by_name(p_query) returns a
        // SETOF jsonb — take the first match's id.
        if (!doctorProfileId) {
          const nameParts = slug.replace(/^dr-/, "").split("-").filter(p => p.length > 1);
          if (nameParts.length >= 1) {
            const { data: results } = await db.rpc("search_doctor_by_name", {
              p_query: nameParts.join(" "),
            });
            const first = Array.isArray(results) ? (results[0] as any) : null;
            if (first?.id) doctorProfileId = first.id as string;
          }
        }
      }

      if (doctorProfileId) {
        setDoctorId(doctorProfileId);
        // Fetch meta for SEO via secure RPC. Returns a SINGLE jsonb object.
        const { data: rows } = await db.rpc("get_public_doctor_profile", {
          p_doctor_id: doctorProfileId,
        });
        const doc = (Array.isArray(rows) ? rows[0] : rows) as any;
        if (doc) {
          const name = doc.display_name || `Dr(a). ${doc.first_name ?? ""} ${doc.last_name ?? ""}`.trim();
          const specialty = doc.specialties?.[0] ?? doc.areas_of_expertise?.[0] ?? "Clínica Geral";
          setDoctorMeta({ name, specialty });
        }
      }
      setLoading(false);
    };
    resolve();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[hsl(200,55%,97%)] via-[hsl(210,45%,93%)] to-[hsl(220,40%,88%)] dark:from-[hsl(200,25%,7%)] dark:via-[hsl(210,20%,9%)] dark:to-[hsl(220,18%,11%)]" />
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!doctorId) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[hsl(200,55%,97%)] via-[hsl(210,45%,93%)] to-[hsl(220,40%,88%)] dark:from-[hsl(200,25%,7%)] dark:via-[hsl(210,20%,9%)] dark:to-[hsl(220,18%,11%)]" />
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold text-foreground">Médico não encontrado</p>
          <p className="text-muted-foreground text-sm">O perfil solicitado não existe ou não está disponível.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {doctorMeta && (
        <SEOHead
          title={`${doctorMeta.name} — ${doctorMeta.specialty} | AloClinica`}
          description={`Agende uma consulta online com ${doctorMeta.name}, especialista em ${doctorMeta.specialty}. Atendimento por videochamada na AloClinica.`}
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "Physician",
            "name": doctorMeta.name,
            "medicalSpecialty": doctorMeta.specialty,
            "url": window.location.href,
            "availableService": {
              "@type": "MedicalProcedure",
              "name": "Teleconsulta",
              "procedureType": "https://schema.org/NoninvasiveProcedure"
            }
          }}
        />
      )}
      <DoctorPublicProfile doctorId={doctorId} />
    </>
  );
};

export default DoctorPublicProfilePage;
