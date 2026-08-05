import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, GraduationCap, Clock, Calendar, ArrowLeft, Award, ShieldCheck, ShieldAlert, Video, Lock, Zap, Gauge, CheckCircle2, Circle, Pencil } from "lucide-react";
import { motion } from "framer-motion";

interface DoctorPublicData {
  id: string;
  bio: string | null;
  consultation_price: number | null;
  crm: string;
  crm_state: string;
  rating: number | null;
  total_reviews: number | null;
  education: string | null;
  experience_years: number | null;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  specialties: string[];
  careAreas: string[];
  crm_verified: boolean;
  is_approved: boolean;
}

interface Review {
  nps_score: number;
  quality_score: number | null;
  comment: string | null;
  created_at: string;
  patient_name: string;
}

const DoctorPublicProfile = ({ doctorId: doctorIdProp }: { doctorId?: string } = {}) => {
  const params = useParams();
  // The /dr/:slug wrapper resolves the slug to an id and passes it as a prop.
  // Fallback to a :doctorId route param if this is ever routed directly.
  const doctorId = doctorIdProp ?? params.doctorId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doctor, setDoctor] = useState<DoctorPublicData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  // Só o próprio médico (dono deste perfil) vê o card "Força do perfil".
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (doctorId) fetchDoctor();
  }, [doctorId]);

  useEffect(() => {
    if (!user || !doctorId) { setIsOwner(false); return; }
    db.from("doctor_profiles").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data }: any) => setIsOwner(!!data && data.id === doctorId));
  }, [user, doctorId]);

  const fetchDoctor = async () => {
    // Use secure RPC instead of direct table access.
    // get_public_doctor_profile returns a SINGLE jsonb object (or null) — not a
    // set — so `data` IS the doctor object. (Guard for array too, in case the
    // RPC is ever changed to SETOF.) It only returns approved+active doctors.
    const { data: rows } = await db.rpc("get_public_doctor_profile", {
      p_doctor_id: doctorId!,
    });

    const doc = (Array.isArray(rows) ? rows[0] : rows) as any;
    if (!doc) { setLoading(false); return; }

    // Fetch care areas
    const { data: careAreasData } = await db
      .from("doctor_care_areas" as any)
      .select("area_name")
      .eq("doctor_id", doc.id);

    // Fetch reviews (satisfaction_surveys is authenticated-only, will work if user is logged in)
    const { data: surveysData } = await db
      .from("satisfaction_surveys")
      .select("nps_score, quality_score, comment, created_at, patient_id")
      .eq("doctor_id", doc.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get patient names for reviews
    const patientIds = [...new Set(surveysData?.map((s: any) => s.patient_id) ?? [])];
    const { data: patientProfiles } = patientIds.length > 0
      ? await db.from("profiles").select("user_id, first_name").in("user_id", patientIds)
      : { data: [] };
    const patientMap = new Map<string, string>(patientProfiles?.map((p: any) => [p.user_id, p.first_name] as [string, string]) ?? []);

    setDoctor({
      id: doc.id,
      bio: doc.bio,
      // RPC keys: price / rating_avg / rating_count / professional_photo_url.
      consultation_price: doc.price ?? doc.consultation_price ?? null,
      crm: doc.crm,
      crm_state: doc.crm_state,
      rating: doc.rating_avg ?? doc.rating ?? null,
      total_reviews: doc.rating_count ?? doc.total_reviews ?? null,
      education: doc.education ?? null,
      experience_years: doc.experience_years ?? null,
      name: `${doc.first_name ?? ""} ${doc.last_name ?? ""}`.trim(),
      display_name: doc.display_name ?? null,
      avatar_url: doc.professional_photo_url ?? doc.avatar_url ?? null,
      specialties: doc.specialties ?? doc.areas_of_expertise ?? [],
      careAreas: (careAreasData as any[])?.map((c: any) => c.area_name) ?? [],
      crm_verified: doc.crm_verified ?? false,
      // The RPC only returns approved+active doctors, so a returned row is approved.
      is_approved: doc.is_approved ?? true,
    });

    setReviews(
      surveysData?.map((s: any) => ({
        nps_score: s.nps_score,
        quality_score: s.quality_score,
        comment: s.comment,
        created_at: s.created_at,
        patient_name: patientMap.get(s.patient_id) ?? "Paciente",
      } as Review)) ?? []
    );

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Médico não encontrado.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
        </div>
      </div>
    );
  }

  const starRating = Math.round((doctor.rating ?? 0) * 2) / 2;

  // Força do perfil — só campos reais do objeto `doctor` que influenciam agendamentos.
  const bioLen = doctor.bio?.trim().length ?? 0;
  const strengthItems = [
    { key: "foto", label: "Foto de perfil", done: !!doctor.avatar_url, tip: "Adicione uma foto profissional — perfis com foto recebem mais agendamentos." },
    { key: "bio", label: "Apresentação (bio)", done: bioLen >= 120, tip: bioLen === 0 ? "Escreva uma bio contando sua experiência e forma de atender." : "Amplie sua bio para pelo menos 120 caracteres." },
    { key: "especialidades", label: "Especialidades", done: doctor.specialties.length > 0, tip: "Cadastre suas especialidades para aparecer nas buscas certas." },
    { key: "areas", label: "Áreas de atendimento", done: doctor.careAreas.length > 0, tip: "Liste as áreas e condições que você atende." },
    { key: "preco", label: "Preço da consulta", done: (doctor.consultation_price ?? 0) > 0, tip: "Defina o valor da sua consulta." },
    { key: "formacao", label: "Formação acadêmica", done: !!doctor.education, tip: "Informe sua formação para reforçar sua credibilidade." },
    { key: "experiencia", label: "Anos de experiência", done: !!doctor.experience_years, tip: "Informe seus anos de experiência." },
    { key: "crm", label: "CRM verificado", done: doctor.crm_verified, tip: "Conclua a verificação do seu CRM para exibir o selo Verificado." },
  ];
  const strengthDone = strengthItems.filter((i) => i.done).length;
  const strengthPct = Math.round((strengthDone / strengthItems.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Header gradient */}
      <div className="bg-gradient-hero h-48 relative">
        <div className="container mx-auto px-4 pt-6">
          <Button variant="ghost" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-20 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
          {/* Profile card */}
          <Card className="shadow-elevated border-border overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar */}
                <div className="w-28 h-28 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 ring-4 ring-background shadow-lg">
                  {doctor.avatar_url ? (
                    <img src={doctor.avatar_url} alt={doctor.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <span className="text-3xl font-bold text-primary">
                      {doctor.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </span>
                  )}
                </div>

                <div className="text-center sm:text-left flex-1">
                  <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                    <h1 className="text-2xl font-bold text-foreground tabular-nums">{doctor.display_name || `Dr(a). ${doctor.name}`}</h1>
                    {doctor.crm_verified ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Verificado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Não verificado
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">CRM {doctor.crm}/{doctor.crm_state}</p>

                  {/* Specialties */}
                  <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                    {doctor.specialties.map(s => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>

                  {/* Care Areas */}
                  {doctor.careAreas.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Áreas de atendimento</p>
                      <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                        {doctor.careAreas.map(a => (
                          <span key={a} className="text-[11px] px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground font-medium">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} className={`w-5 h-5 ${i <= starRating ? "text-yellow-500 fill-yellow-500" : i - 0.5 <= starRating ? "text-yellow-500 fill-yellow-500/50" : "text-muted-foreground/20"}`} />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{doctor.rating?.toFixed(1) ?? "0.0"}</span>
                    <span className="text-xs text-muted-foreground">({doctor.total_reviews ?? 0} avaliações)</span>
                  </div>

                  {/* Quick stats */}
                  <div className="flex flex-wrap gap-4 mt-4 justify-center sm:justify-start">
                    {doctor.experience_years && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {doctor.experience_years} anos de experiência
                      </div>
                    )}
                    {doctor.education && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <GraduationCap className="w-4 h-4" />
                        {doctor.education}
                      </div>
                    )}
                  </div>

                  {/* Trust strip */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 justify-center sm:justify-start text-[11px] font-semibold">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Video className="w-3.5 h-3.5" /> Atende em telemedicina
                    </span>
                    <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <Zap className="w-3.5 h-3.5" /> Resposta rápida
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Lock className="w-3.5 h-3.5" /> Consulta criptografada
                    </span>
                  </div>
                </div>

                {/* Price + CTA */}
                <div className="text-center shrink-0">
                  <p className="text-sm text-muted-foreground">Consulta a partir de</p>
                  <p className="text-3xl font-bold text-primary">
                    R$ {(doctor.consultation_price ?? 89).toFixed(2).replace(".", ",")}
                  </p>
                  <Button
                    className="mt-3 bg-gradient-hero text-primary-foreground rounded-full px-6"
                    onClick={() => navigate(`/dashboard/schedule/${doctor.id}`)}
                  >
                    <Calendar className="w-4 h-4 mr-2" /> Agendar
                  </Button>
                </div>
              </div>

              {/* Bio */}
              {doctor.bio && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="font-semibold text-foreground mb-2">Sobre</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{doctor.bio}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Força do perfil — coach visível apenas para o próprio médico */}
          {isOwner && (
            <Card className="mt-6 border-primary/20 bg-primary/[0.03]">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-foreground">Força do perfil</h3>
                    <Badge variant="secondary" className="text-[10px]">visível só para você</Badge>
                  </div>
                  <span className="text-2xl font-black text-primary tabular-nums leading-none">{strengthPct}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {strengthDone} de {strengthItems.length} itens que ajudam pacientes a escolher você.
                </p>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all" style={{ width: `${strengthPct}%` }} />
                </div>

                {strengthDone === strengthItems.length ? (
                  <p className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Perfil completo! Nada a melhorar por aqui.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2.5">
                    {strengthItems.map((item) => (
                      <li key={item.key} className="flex items-start gap-2.5">
                        {item.done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${item.done ? "text-muted-foreground" : "text-foreground"}`}>{item.label}</p>
                          {!item.done && <p className="text-xs text-muted-foreground mt-0.5">{item.tip}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => navigate("/dashboard/profile?role=doctor")}
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar meu perfil
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Reviews */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Avaliações dos Pacientes ({reviews.length})
            </h2>

            {reviews.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <Star className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Rating summary card */}
                <Card className="mb-4 border-border/60 bg-gradient-to-br from-card via-card to-muted/30">
                  <CardContent className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-6 items-center">
                      <div className="text-center sm:text-left">
                        <div className="text-5xl font-black text-foreground tabular-nums leading-none">
                          {(doctor.rating ?? 0).toFixed(1)}
                        </div>
                        <div className="flex items-center gap-0.5 mt-2 justify-center sm:justify-start">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${i <= Math.round(doctor.rating ?? 0) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">
                          {doctor.total_reviews ?? reviews.length} {(doctor.total_reviews ?? reviews.length) === 1 ? "avaliação" : "avaliações"}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {[5, 4, 3, 2, 1].map(stars => {
                          const count = reviews.filter(r => Math.round(((r.quality_score ?? r.nps_score / 2) / 5) * 5) === stars).length;
                          const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                          return (
                            <button
                              key={stars}
                              type="button"
                              onClick={() => setRatingFilter(ratingFilter === stars ? null : stars)}
                              className={`w-full flex items-center gap-2 group rounded-lg px-1.5 py-0.5 transition-colors ${ratingFilter === stars ? "bg-primary/10" : "hover:bg-muted/50"}`}
                            >
                              <span className="text-[11px] font-semibold text-muted-foreground w-3 tabular-nums">{stars}</span>
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono text-muted-foreground w-6 text-right tabular-nums">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {ratingFilter !== null && (
                      <button
                        type="button"
                        onClick={() => setRatingFilter(null)}
                        className="mt-3 text-[11px] font-semibold text-primary hover:underline"
                      >
                        Limpar filtro
                      </button>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-3">
                {reviews
                  .filter(r => ratingFilter === null || Math.round(((r.quality_score ?? r.nps_score / 2) / 5) * 5) === ratingFilter)
                  .map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {r.patient_name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{r.patient_name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(r.created_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(((r.quality_score ?? r.nps_score / 2) / 5) * 5) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`} />
                            ))}
                          </div>
                        </div>
                        {r.comment && (
                          <p className="text-sm text-muted-foreground mt-2">"{r.comment}"</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
                {reviews.filter(r => ratingFilter === null || Math.round(((r.quality_score ?? r.nps_score / 2) / 5) * 5) === ratingFilter).length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-muted-foreground">Nenhuma avaliação com {ratingFilter} {ratingFilter === 1 ? "estrela" : "estrelas"}.</p>
                    </CardContent>
                  </Card>
                )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DoctorPublicProfile;
