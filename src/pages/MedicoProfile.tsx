import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import Header from "@/components/landing/Header";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Star, ShieldCheck, Video, Clock, ArrowLeft, MapPin, Loader2, CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";

type DoctorRow = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  short_description: string | null;
  consultation_price: number | null;
  consultation_duration_min: number | null;
  crm: string | null;
  crm_state: string | null;
  crm_verified: boolean | null;
  rating: number | null;
  total_reviews: number | null;
  experience_years: number | null;
  education: string | null;
  specialty_names: string[] | null;
  sub_specialties: string[] | null;
  available_now: boolean | null;
  has_availability: boolean | null;
};

type Slot = { day_of_week: number; start_time: string; end_time: string };

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MedicoProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<DoctorRow | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: doc }, { data: avail }] = await Promise.all([
        db.from("doctor_profiles_public").select("*").eq("id", id).maybeSingle(),
        db
          .from("availability_slots")
          .select("day_of_week, start_time, end_time")
          .eq("doctor_id", id)
          .eq("is_active", true)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true }),
      ]);
      if (!active) return;
      if (!doc) {
        setNotFound(true);
      } else {
        setDoctor(doc as DoctorRow);
        setSlots((avail ?? []) as Slot[]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const slotsByDay = useMemo(() => {
    const map = new Map<number, Slot[]>();
    for (const s of slots) {
      if (!map.has(s.day_of_week)) map.set(s.day_of_week, []);
      map.get(s.day_of_week)!.push(s);
    }
    return map;
  }, [slots]);

  const handleAgendar = () => {
    if (!doctor) return;
    const returnUrl = `/dashboard/schedule/${doctor.id}`;
    navigate(`/paciente?redirect=${encodeURIComponent(returnUrl)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !doctor) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-32 text-center px-4 max-w-md mx-auto space-y-4">
          <p className="text-lg font-semibold">Médico não encontrado</p>
          <p className="text-sm text-muted-foreground">
            O perfil que você procura não está disponível.
          </p>
          <Button variant="outline" onClick={() => navigate("/agendar")}>
            Ver todos os médicos
          </Button>
        </div>
      </div>
    );
  }

  const name = doctor.display_name || doctor.full_name || "Profissional";
  const price = doctor.consultation_price ?? 0;
  const duration = doctor.consultation_duration_min ?? 30;
  const returnPrice = Math.round(price * 0.7);
  const rating = doctor.rating ?? 0;
  const initials = name
    .replace(/^Dr[(a)]*\.?\s*/i, "")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <>
      <SEOHead
        title={`${name} — Teleconsulta | AloClínica`}
        description={`Agende sua teleconsulta com ${name}. ${(doctor.specialty_names ?? []).join(", ")}. Atendimento por vídeo, seguro e prático.`}
      />
      <div className="min-h-screen bg-background">
        <Header />

        <div className="pt-24 pb-20 px-4">
          <div className="max-w-5xl mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="mb-4 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
            </Button>

            <div className="grid lg:grid-cols-[1fr,360px] gap-6">
              {/* MAIN COLUMN */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Identity card */}
                <Card className="overflow-hidden border-border/60 shadow-sm">
                  <div className="h-24 bg-gradient-to-r from-primary/80 via-primary to-secondary" />
                  <CardContent className="p-6 sm:p-8 -mt-14">
                    <div className="flex flex-col sm:flex-row items-start gap-5">
                      <div className="w-28 h-28 rounded-2xl bg-primary/10 ring-4 ring-background shadow-lg overflow-hidden flex items-center justify-center shrink-0">
                        {doctor.avatar_url ? (
                          <img
                            src={doctor.avatar_url}
                            alt={name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-3xl font-bold text-primary">{initials}</span>
                        )}
                      </div>
                      <div className="flex-1 pt-2 sm:pt-12">
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="font-display text-2xl sm:text-3xl font-black text-foreground">
                            {name}
                          </h1>
                          {doctor.crm_verified && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" /> Verificado
                            </Badge>
                          )}
                          {doctor.available_now && (
                            <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30 gap-1">
                              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                              Atende agora
                            </Badge>
                          )}
                        </div>
                        {doctor.crm && (
                          <p className="text-sm text-muted-foreground mt-1">
                            CRM {doctor.crm}
                            {doctor.crm_state ? `/${doctor.crm_state}` : ""}
                          </p>
                        )}

                        {(doctor.specialty_names?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {doctor.specialty_names!.map((s) => (
                              <Badge key={s} variant="secondary" className="text-xs">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span className="font-semibold text-foreground">
                              {rating.toFixed(1)}
                            </span>
                            <span>({doctor.total_reviews ?? 0} avaliações)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" /> {duration} min por consulta
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Video className="w-4 h-4" /> Atendimento por vídeo
                          </div>
                        </div>
                      </div>
                    </div>

                    {(doctor.bio || doctor.short_description) && (
                      <div className="mt-6 pt-6 border-t border-border/60">
                        <h2 className="font-semibold text-foreground mb-2">Sobre</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                          {doctor.bio || doctor.short_description}
                        </p>
                      </div>
                    )}

                    {(doctor.sub_specialties?.length ?? 0) > 0 && (
                      <div className="mt-6 pt-6 border-t border-border/60">
                        <h2 className="font-semibold text-foreground mb-3">
                          Áreas de atuação
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                          {doctor.sub_specialties!.map((a) => (
                            <span
                              key={a}
                              className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Schedule card */}
                <Card className="border-border/60">
                  <CardContent className="p-6 sm:p-8">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" /> Horários de atendimento
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Janelas semanais em que este profissional aceita agendamentos.
                    </p>

                    {slots.length === 0 ? (
                      <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                        Sem horários publicados no momento.
                      </div>
                    ) : (
                      <div className="mt-5 grid sm:grid-cols-2 gap-3">
                        {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                          const items = slotsByDay.get(day) ?? [];
                          if (items.length === 0) return null;
                          return (
                            <div
                              key={day}
                              className="rounded-xl border border-border/60 p-3 bg-card"
                            >
                              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                                {DAY_LABELS[day]}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {items.map((s, i) => (
                                  <span
                                    key={i}
                                    className="text-xs px-2 py-1 rounded-md bg-primary/8 text-foreground font-mono tabular-nums"
                                  >
                                    {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* SIDE: PRICING + CTA */}
              <motion.aside
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="lg:sticky lg:top-24 self-start"
              >
                <Card className="border-border/60 shadow-md">
                  <CardContent className="p-6 space-y-5">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        Consulta a partir de
                      </p>
                      <p className="text-4xl font-black text-primary mt-1">
                        R$ {price.toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ou retorno em até 30 dias por R${" "}
                        {returnPrice.toFixed(2).replace(".", ",")}
                      </p>
                    </div>

                    <Button
                      size="lg"
                      className="w-full rounded-xl font-bold h-12 shadow-sm"
                      onClick={handleAgendar}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Agendar consulta
                    </Button>

                    <ul className="space-y-2 pt-2 border-t border-border/60">
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Pagamento seguro
                      </li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Receita e atestado digitais
                      </li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Cancelamento gratuito até 2h antes
                      </li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-4 h-4 text-primary" /> Atende em todo o Brasil
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.aside>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MedicoProfile;