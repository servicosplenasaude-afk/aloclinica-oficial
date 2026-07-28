import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "@/integrations/supabase/untyped";
import { triggerAppointmentConfirmed } from "@/lib/whatsapp";
import { notifyNewAppointment, notifyPaymentConfirmed } from "@/lib/notifications";
import { useAuth } from "@/contexts/AuthContext";
import { logError } from "@/lib/logger";
import { explainError, toastError } from "@/lib/errorMessages";
import { validateCard } from "@/lib/card-utils";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft, Clock, Star, Check, UserPlus, UserCheck, Loader2,
  CalendarDays, CheckCircle2, ChevronRight, Stethoscope, QrCode, CreditCard,
  FileBarChart, Lock, Shield, Copy, Tag, X as XIcon
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, setHours, setMinutes, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getFeriadosNacionais } from "@/lib/feriados";
import { useContrato } from "@/contexts/ContratoContext";

import { getPatientNav } from "./patientNav";
import {
  type PaymentMethod,
  type DoctorInfo,
  STEPS,
  KYC_PENDING_KEY,
} from "./BookAppointment.types";
import { usePixCountdown } from "@/hooks/usePixCountdown";
import QuickPatientCheckoutDialog, { isProfileComplete } from "./QuickPatientCheckoutDialog";
import { useSavedCards } from "@/components/billing/useSavedCards";
import SavedCardCheckout, { chargeSavedCard } from "@/components/billing/SavedCardCheckout";
import ConsentDialog from "@/components/legal/ConsentDialog";
import type { LegalKind } from "@/lib/legal-docs";
import AppPromotionalBanners from "@/components/dashboards/AppPromotionalBanners";

const patientNav = getPatientNav("schedule");

const BookAppointment = () => {
  const { doctorId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isContratoMode, contratoAtivo } = useContrato();
  const kycPending = localStorage.getItem(KYC_PENDING_KEY) === "true";

  const [doctor, setDoctor] = useState<DoctorInfo | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [appointmentType, setAppointmentType] = useState<string>("first_visit");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [dependents, setDependents] = useState<{ id: string; name: string; relationship: string; user_id?: string | null; source?: "legacy" | "family" }[]>([]);
  const [bookingFor, setBookingFor] = useState<string>("self");
  const [feriados, setFeriados] = useState<Date[]>([]);

  // Return eligibility — retorno com 50% de desconto (consulta concluída dentro do prazo de retorno).
  // returnOffered: paciente é elegível (existe consulta concluída no prazo) → controla a OFERTA na UI.
  // returnEligible: oferta aceita (paciente marcou "É retorno") → dispara o DESCONTO no preço.
  const [returnOffered, setReturnOffered] = useState(false);
  const [returnEligible, setReturnEligible] = useState(false);

  // Payment state
  const [paymentStep, setPaymentStep] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [processing, setProcessing] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardDiscount, setCardDiscount] = useState(0);

  // Cartões salvos (vault MP) — pagar em 1 toque
  const { cards: savedCards, addCard, loading: savedCardsLoading } = useSavedCards();
  const [useNewCard, setUseNewCard] = useState(false);
  const [saveCardNext, setSaveCardNext] = useState(false);
  // Cobrança de cartão salvo pendente enquanto o termo de consentimento não é aceito
  const pendingSavedPayRef = useRef<{ savedCardId: string; securityCode?: string } | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);

  // Quick patient checkout dialog (cadastro rápido antes da reserva)
  const [quickOpen, setQuickOpen] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  // Aceite do termo da consulta (CFM 2.314/2022) — bloqueia o pagamento até confirmar
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentDone, setConsentDone] = useState(false);
  const consentKind: LegalKind = isContratoMode ? "telemed_contract" : "telemed_scheduled";

  const currentStep = paymentStep ? 3 : !selectedDate ? 0 : !selectedTime ? 1 : 2;

  useEffect(() => {
    if (user) {
      Promise.all([
        db.from("dependents").select("id, name, relationship").eq("user_id", user.id),
        db.from("family_members").select("id, full_name, relationship, user_id").eq("holder_user_id", user.id),
      ]).then(([legacy, family]) => {
        const merged: typeof dependents = [
          ...((legacy.data ?? []) as any[]).map((d: any) => ({ id: d.id, name: d.name, relationship: d.relationship, source: "legacy" as const })),
          ...((family.data ?? []) as any[]).map((f: any) => ({ id: f.id, name: f.full_name, relationship: f.relationship ?? "dependente", user_id: f.user_id ?? null, source: "family" as const })),
        ];
        setDependents(merged);
      });
    }
    const currentYear = new Date().getFullYear();
    Promise.all([getFeriadosNacionais(currentYear), getFeriadosNacionais(currentYear + 1)])
      .then(([f1, f2]) => setFeriados([...f1, ...f2]));
  }, [user]);

  useEffect(() => {
    if (doctorId) fetchDoctor();
  }, [doctorId]);

  // Retomar pagamento de uma consulta PENDENTE (botão "Pagar" da lista envia
  // ?resume=<appointmentId>). Sem isto, o paciente recaía no início do fluxo e
  // criava uma consulta DUPLICADA em vez de pagar a pendente. Guardado pelo param:
  // sem ?resume, o fluxo normal de agendamento não é afetado.
  useEffect(() => {
    const resumeId = searchParams.get("resume");
    if (!resumeId || !doctor || !user) return;
    (async () => {
      const { data: appt } = await db
        .from("appointments")
        .select("id, patient_id, doctor_id, scheduled_at, status, payment_status")
        .eq("id", resumeId)
        .maybeSingle();
      const a = appt as { id: string; patient_id: string; doctor_id: string; scheduled_at: string; status: string; payment_status: string } | null;
      // Só retoma a própria consulta, deste médico, ainda pendente de pagamento.
      if (!a || a.patient_id !== user.id || a.doctor_id !== doctor.id) return;
      if (a.status !== "scheduled" || !["pending", "refused"].includes(a.payment_status)) return;
      const dt = new Date(a.scheduled_at);
      setSelectedDate(dt);
      setSelectedTime(format(dt, "HH:mm"));
      setAppointmentId(a.id);
      setPaymentStep(true);
    })();
  }, [searchParams, doctor, user]);

  // Check return eligibility — roda independente do tipo escolhido para decidir se a
  // opção de retorno é oferecida (returnOffered). O desconto no preço (returnEligible)
  // só vale quando o paciente É elegível E marcou "É retorno".
  useEffect(() => {
    const checkReturn = async () => {
      if (!user || !doctorId) {
        setReturnOffered(false);
        setReturnEligible(false);
        return;
      }
      // Elegível a retorno: existe consulta concluída com este médico cujo prazo de retorno ainda é válido.
      const { data } = await db
        .from("appointments")
        .select("id, return_deadline")
        .eq("patient_id", user.id)
        .eq("doctor_id", doctorId)
        .eq("status", "completed")
        .not("return_deadline", "is", null)
        .gte("return_deadline", new Date().toISOString())
        .order("scheduled_at", { ascending: false })
        .limit(1);
      const eligible = Boolean(data && data.length > 0);
      setReturnOffered(eligible);
      setReturnEligible(eligible && appointmentType === "return");
    };
    checkReturn();
  }, [appointmentType, user, doctorId]);

  useEffect(() => {
    if (selectedDate && doctorId) fetchBookedSlots();
  }, [selectedDate]);

  // PIX expiry countdown (Mercado Pago QR codes expire after 30 minutes)
  const { secondsLeft: pixSecondsLeft, expired: pixExpired } = usePixCountdown(pixQrCode, () => {
    toast.error("PIX expirado", { description: "O QR Code expirou. Clique em 'Gerar novo PIX' para continuar." });
  });

  // Realtime payment confirmation with fallback polling
  useEffect(() => {
    if (!paymentStep || !appointmentId) return;
    const hasPending = pixQrCode || boletoUrl;
    if (!hasPending) return;

    let isSubscribed = true;
    let pollTimer: NodeJS.Timeout | null = null;
    let attempt = 0;
    const PAID = ["approved", "confirmed", "received"] as const;

    const onConfirmed = () => {
      if (!isSubscribed) return;
      cleanup();
      toast.success("✅ Pagamento confirmado! Consulta garantida.");
      navigate(`/dashboard/appointments/${appointmentId}/confirmed`);
    };

    const checkOnce = async () => {
      if (!isSubscribed) return false;
      try {
        const { data } = await db
          .from("appointments")
          .select("payment_status")
          .eq("id", appointmentId)
          .maybeSingle();
        if (data && PAID.includes(data.payment_status as any)) {
          onConfirmed();
          return true;
        }
      } catch {
        /* network blip — try again next tick */
      }
      return false;
    };

    // Polling com backoff: 3s → 5s → 8s → 12s (cap)
    const scheduleNext = () => {
      if (!isSubscribed) return;
      const delays = [3000, 3000, 5000, 5000, 8000];
      const delay = delays[Math.min(attempt, delays.length - 1)] ?? 12000;
      attempt += 1;
      pollTimer = setTimeout(async () => {
        const done = await checkOnce();
        if (!done) scheduleNext();
      }, delay);
    };

    // Realtime listener (caminho primário)
    const channel = db
      .channel(`payment-${appointmentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `id=eq.${appointmentId}`,
        },
        (payload) => {
          if (isSubscribed && PAID.includes(payload.new?.payment_status)) {
            onConfirmed();
          }
        }
      )
      .subscribe();

    // Reagir ao voltar para a aba (PIX é frequentemente pago em outro app)
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkOnce();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    function cleanup() {
      isSubscribed = false;
      if (pollTimer) clearTimeout(pollTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      try { channel.unsubscribe(); } catch { /* noop */ }
    }

    // Checagem imediata + iniciar polling em paralelo ao realtime
    checkOnce().then((done) => { if (!done) scheduleNext(); });

    return cleanup;
  }, [paymentStep, appointmentId, pixQrCode, boletoUrl]);

  const fetchDoctor = async () => {
    try {
      const { data: doc, error } = await db
        .from("doctor_profiles")
        .select("id, user_id, crm, crm_state, bio, price, rating, experience_years, doctor_type")
        .eq("id", doctorId!)
        .single();

      if (error || !doc) {
        toast.error("Médico não encontrado", { description: "Verifique o link e tente novamente." });
        navigate(-1);
        setLoading(false);
        return;
      }

      const [profileRes, specsRes, slotsRes] = await Promise.all([
        db.from("profiles").select("first_name, last_name").eq("user_id", doc.user_id).single(),
        db.from("doctor_specialties").select("specialties(name)").eq("doctor_id", doc.id),
        db.from("availability_slots").select("day_of_week, start_time, end_time").eq("doctor_id", doc.id).eq("is_active", true),
      ]);

      setDoctor({
        ...doc,
        consultation_price: Number(doc.price),
        rating: Number(doc.rating),
        first_name: profileRes.data?.first_name ?? "",
        last_name: profileRes.data?.last_name ?? "",
        specialties: specsRes.data?.map((s: { specialties?: { name?: string } | null }) => s.specialties?.name).filter(Boolean) as string[] ?? [],
        slots: slotsRes.data ?? [],
      });
    } catch (err) {
      logError("[BookAppointment] fetchDoctor error", err);
      toast.error("Erro ao carregar médico", { description: "Tente novamente." });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookedSlots = async () => {
    if (!selectedDate || !doctorId) return;
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const { data } = await db
      .from("appointments")
      .select("scheduled_at")
      .eq("doctor_id", doctorId)
      .gte("scheduled_at", dayStart.toISOString())
      .lte("scheduled_at", dayEnd.toISOString())
      .neq("status", "cancelled");

    setBookedSlots(data?.map(a => format(new Date(a.scheduled_at), "HH:mm")) ?? []);
  };

  const getAvailableTimesForDate = (date: Date): string[] => {
    if (!doctor) return [];
    const dayOfWeek = date.getDay();
    const daySlots = doctor.slots.filter(s => s.day_of_week === dayOfWeek);

    const times: string[] = [];
    daySlots.forEach(slot => {
      const [startH, startM] = slot.start_time.split(":").map(Number);
      const [endH, endM] = slot.end_time.split(":").map(Number);
      let h = startH, m = startM;

      while (h < endH || (h === endH && m < endM)) {
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const slotDateTime = setMinutes(setHours(new Date(date), h), m);

        if (!bookedSlots.includes(timeStr) && !isBefore(slotDateTime, new Date())) {
          times.push(timeStr);
        }
        m += 30;
        if (m >= 60) { h++; m = 0; }
      }
    });

    return times;
  };

  const isDayAvailable = (date: Date): boolean => {
    if (!doctor) return false;
    if (isBefore(date, new Date()) && date.toDateString() !== new Date().toDateString()) return false;
    const isFeriado = feriados.some(f => f.getFullYear() === date.getFullYear() && f.getMonth() === date.getMonth() && f.getDate() === date.getDate());
    if (isFeriado) return false;
    const dayOfWeek = date.getDay();
    return doctor.slots.some(s => s.day_of_week === dayOfWeek);
  };

  // Próximos horários abertos: varre a agenda semanal do médico a partir de agora e
  // devolve os primeiros `limit` slots. Reaproveita doctor.slots já carregado; a
  // checagem anti-duplo-agendamento roda na confirmação (handleBook) e no índice do banco.
  const getUpcomingSlots = (limit = 5): { date: Date; time: string }[] => {
    if (!doctor) return [];
    const now = new Date();
    const result: { date: Date; time: string }[] = [];
    for (let offset = 0; offset < 30 && result.length < limit; offset++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      if (!isDayAvailable(date)) continue;
      const dayOfWeek = date.getDay();
      const daySlots = doctor.slots.filter(s => s.day_of_week === dayOfWeek);
      const times: string[] = [];
      daySlots.forEach(slot => {
        const [startH, startM] = slot.start_time.split(":").map(Number);
        const [endH, endM] = slot.end_time.split(":").map(Number);
        let h = startH, m = startM;
        while (h < endH || (h === endH && m < endM)) {
          const slotDateTime = setMinutes(setHours(new Date(date), h), m);
          if (!isBefore(slotDateTime, now)) times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
          m += 30;
          if (m >= 60) { h++; m = 0; }
        }
      });
      times.sort();
      for (const t of times) {
        if (result.length >= limit) break;
        result.push({ date: new Date(date), time: t });
      }
    }
    return result;
  };

  const fullPrice = doctor?.consultation_price ?? 89;
  // Retorno: 50% de desconto sobre o preço do médico quando o paciente é elegível
  // (consulta concluída com prazo de retorno válido). Cupom/cartão incidem sobre a base já com o retorno.
  const RETURN_DISCOUNT_PCT = 50;
  const returnDiscountAmount = returnEligible ? fullPrice * (RETURN_DISCOUNT_PCT / 100) : 0;
  const basePrice = fullPrice - returnDiscountAmount;
  const discountAmount = basePrice * (cardDiscount / 100);
  const couponAmount = basePrice * (couponDiscount / 100);
  const totalPrice = Math.max(basePrice - discountAmount - couponAmount, 0);

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    try {
      const { data, error } = await db
        .from("coupons")
        .select("id, code, discount_percentage, max_uses, times_used, expires_at, is_active")
        .eq("code", code)
        .maybeSingle();
      if (error || !data) {
        toast.error("Cupom inválido", { description: "Verifique o código e tente novamente." });
        setCouponLoading(false);
        return;
      }
      if (!data.is_active) {
        toast.error("Cupom inativo");
        setCouponLoading(false);
        return;
      }
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        toast.error("Cupom expirado");
        setCouponLoading(false);
        return;
      }
      if (data.max_uses && data.times_used >= data.max_uses) {
        toast.error("Cupom esgotado");
        setCouponLoading(false);
        return;
      }
      setCouponCode(data.code);
      setCouponDiscount(Number(data.discount_percentage) || 0);
      toast.success(`Cupom ${data.code} aplicado!`, {
        description: `${data.discount_percentage}% de desconto na consulta.`,
      });
    } catch {
      toast.error("Não foi possível validar o cupom");
    }
    setCouponLoading(false);
  };

  const removeCoupon = () => {
    setCouponCode(null);
    setCouponDiscount(0);
    setCouponInput("");
  };

  // Step 1: Create appointment, then move to payment
  const handleBook = async () => {
    if (!selectedDate || !selectedTime || !doctor || !user) return;

    // Cadastro rápido: bloqueia até termos nome/cpf/telefone/nascimento
    if (!profileReady) {
      const { data: profile } = await db
        .from("profiles")
        .select("first_name, last_name, cpf, phone, date_of_birth")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isProfileComplete(profile)) {
        setQuickOpen(true);
        return;
      }
      setProfileReady(true);
    }

    setBooking(true);

    const [h, m] = selectedTime.split(":").map(Number);
    const scheduledAt = setMinutes(setHours(new Date(selectedDate), h), m);

    // Valida que o horário não está no passado (link/sessão expirados)
    if (isBefore(scheduledAt, new Date())) {
      setBooking(false);
      toast.error("Horário expirado", { description: "O horário selecionado já passou. Escolha outro." });
      setSelectedTime(null);
      return;
    }

    const dependentInfo = bookingFor !== "self" ? dependents.find(d => d.id === bookingFor) : null;
    // Se o dependente tem conta na plataforma (family_members.user_id), a consulta é REGISTRADA NO NOME DELE.
    // Caso contrário, paciente_id segue o titular, com identificação nos notes (compat com fluxo legado).
    const patientUserIdForAppt = dependentInfo?.user_id ?? user.id;
    const notesText = dependentInfo
      ? (dependentInfo.user_id
          ? `Agendado pelo titular ${user.email ?? ""} — paciente: ${dependentInfo.name} (${dependentInfo.relationship})`
          : `Consulta para dependente: ${dependentInfo.name} (${dependentInfo.relationship})`)
      : null;

    // Só consulta avulsa (sem recorrência/pacote).
    const datesToBook: Date[] = [scheduledAt];

    // Revalida disponibilidade de todos os slots no momento da confirmação (anti double-booking)
    {
      const { data: conflicts } = await db
        .from("appointments")
        .select("scheduled_at")
        .eq("doctor_id", doctor.id)
        .neq("status", "cancelled")
        .in("scheduled_at", datesToBook.map(d => d.toISOString()));

      if (conflicts && conflicts.length > 0) {
        setBooking(false);
        const conflictTimes = conflicts
          .map(c => format(new Date(c.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR }))
          .join(", ");
        toast.error("Horário indisponível", {
          description: `${conflictTimes} acabou de ser reservado por outra pessoa. Selecione outro horário.`,
        });
        setSelectedTime(null);
        // Recarrega slots ocupados do dia para refletir a mudança
        try {
          const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(selectedDate); dayEnd.setHours(23, 59, 59, 999);
          const { data: dayAppts } = await db.from("appointments").select("scheduled_at")
            .eq("doctor_id", doctor.id).gte("scheduled_at", dayStart.toISOString())
            .lte("scheduled_at", dayEnd.toISOString()).neq("status", "cancelled");
          setBookedSlots(dayAppts?.map((a: any) => format(new Date(a.scheduled_at), "HH:mm")) ?? []);
        } catch {/* ignore */}
        return;
      }
    }

    let firstApptId: string | null = null;
    let errorOccurred = false;

    for (const dt of datesToBook) {
      // Use doctor_type as appointment_type if available (telemedicina),
      // otherwise use appointmentType (first_visit/return)
      const apptType = firstApptId
        ? "return"
        : (doctor.doctor_type === "telemedicina")
          ? doctor.doctor_type
          : appointmentType;

      const { data: insertedAppt, error } = await db.from("appointments").insert({
        patient_id: patientUserIdForAppt,
        doctor_id: doctor.id,
        scheduled_at: dt.toISOString(),
        status: "scheduled",
        payment_status: "pending",
        appointment_type: apptType,
        notes: notesText ? notesText + (firstApptId ? ` | Recorrente` : "") : (firstApptId ? "Agendamento recorrente" : null),
        original_appointment_id: firstApptId || null,
        price_at_booking: basePrice,
      }).select("id").single();

      if (error || !insertedAppt) {
        // Erro 23505 = unique violation (índice anti double-booking no banco)
        const code = (error as any)?.code;
        if (code === "23505") {
          setBooking(false);
          toast.error("Horário indisponível", {
            description: "Este horário acabou de ser reservado por outra pessoa. Selecione outro horário.",
          });
          setSelectedTime(null);
          return;
        }
        errorOccurred = true;
        break;
      }

      if (!firstApptId) firstApptId = insertedAppt.id;
    }

    setBooking(false);

    if (errorOccurred || !firstApptId) {
      toastError(toast, errorOccurred || "agendamento_falhou", "agendamento");
    } else {
      // Cobertura por contrato: subdomínio/path (contratoAtivo) OU voucher de
      // ação social guardado na sessão (AcoesEntrar). Se cobrir, pula o pagamento.
      let coverContratoId: string | null = (isContratoMode && contratoAtivo) ? contratoAtivo.id : null;
      let coverVoucher: string | null = null;
      try {
        const vraw = sessionStorage.getItem("aloclinica_voucher");
        if (vraw) {
          const v = JSON.parse(vraw);
          if (v?.contrato?.id) { coverContratoId = v.contrato.id; coverVoucher = v?.voucher?.codigo ?? null; }
        }
      } catch { /* ignore */ }

      // Rede de segurança: paciente logado que é beneficiário (por CPF/user_id)
      // de um contrato ativo é coberto mesmo sem ter entrado pelo portal.
      if (!coverContratoId) {
        try {
          const { data: mc } = await db.rpc("meu_contrato_ativo");
          const row = Array.isArray(mc) ? mc[0] : mc;
          if (row?.contrato_id) coverContratoId = row.contrato_id;
        } catch { /* ignore */ }
      }

      if (coverContratoId) {
        try {
          const { data: cc } = await db.functions.invoke("contrato-checkout", {
            body: { appointment_id: firstApptId, contrato_id: coverContratoId, voucher_codigo: coverVoucher },
          });
          if (cc?.ok) {
            sessionStorage.removeItem("aloclinica_voucher");
            toast.success("Consulta confirmada pelo contrato! ✅");
            navigate(`/dashboard/appointments/${firstApptId}/confirmed`);
            return;
          }
          toast.message("Sem cobertura de contrato para este perfil — siga com o pagamento.");
        } catch (e) {
          logError("contrato-checkout falhou", e);
        }
      }
      setAppointmentId(firstApptId);
      setPaymentStep(true);
      if (!coverContratoId) toast.success("Consulta reservada! Agora finalize o pagamento.");
    }
  };

  // Step 2: Process payment via Mercado Pago — protegido contra double-submit
  const handlePayment = async () => {
    if (processing) return; // Defesa síncrona extra (StrictMode, F5, double-click)
    if (!user || !doctor || !appointmentId) return;
    // Termo da consulta deve ser aceito antes de qualquer pagamento / bypass de contrato.
    if (!consentDone) { setConsentOpen(true); return; }
    if (paymentMethod === "card") {
      const cardError = validateCard(cardName, cardNumber, cardExpiry, cardCvv);
      if (cardError) { toast.error(cardError); return; }
    }
    setProcessing(true);

    try {
      const { data: profile } = await db
        .from("profiles")
        .select("first_name, last_name, cpf, phone")
        .eq("user_id", user.id)
        .single();

      if (!profile?.cpf) {
        toast.error("CPF obrigatório", { description: "Complete seu perfil com o CPF antes de pagar." });
        setProcessing(false);
        return;
      }

      const methodMap: Record<PaymentMethod, "pix" | "credit_card" | "boleto"> = {
        pix: "pix",
        card: "credit_card",
        boleto: "boleto",
      };

      const payload: Record<string, any> = {
        amount: totalPrice,
        payment_method: methodMap[paymentMethod],
        reference_id: `appointment_${appointmentId}`,
        description: `Consulta médica AloClínica`,
        // Cupom é REVALIDADO no servidor (só o código trafega; o % é relido lá).
        coupon_code: couponCode || undefined,
      };

      // Card tokenization via Mercado Pago JS SDK
      if (paymentMethod === "card") {
        const [expiryMonth, expiryYear] = cardExpiry.split("/");
        try {
          const { createCardToken, detectCardBrand } = await import("@/lib/mercadopago");
          const token = await createCardToken({
            cardNumber: cardNumber.replace(/\s/g, ""),
            cardholderName: cardName,
            cardExpirationMonth: expiryMonth,
            cardExpirationYear: expiryYear,
            securityCode: cardCvv,
            identificationType: "CPF",
            identificationNumber: profile.cpf,
          });
          payload.card_token = token.id;
          payload.payment_method_id = token.payment_method_id ?? detectCardBrand(cardNumber);
          payload.installments = 1;
        } catch (e) {
          toastError(toast, e, "pagamento");
          setProcessing(false);
          return;
        }
      }

      const { data, error } = await db.functions.invoke("mercadopago-create-payment", { body: payload });

      if (error || !data?.payment_id || data?.error) {
        toastError(toast, data?.error || error?.message || "pagamento_falhou", "pagamento");
        setProcessing(false);
        return;
      }

      if (paymentMethod === "pix") {
        setPixQrCode(data.qr_code_base64 || null);
        setPixCopyPaste(data.qr_code || null);
        setProcessing(false);
        toast.success("PIX gerado! 🎉", { description: "Escaneie o QR Code para pagar." });
        return;
      }

      if (paymentMethod === "boleto") {
        setBoletoUrl(data.boleto_url || null);
        setProcessing(false);
        toast.success("Boleto gerado! 📄");
        return;
      }

      // Card — usually instant
      if (data.status === "approved") {
        // Oferecer salvar o cartão no vault para a próxima vez (tokeniza de novo via addCard)
        if (saveCardNext) {
          const [em, ey] = cardExpiry.split("/");
          await addCard({
            holder: cardName,
            number: cardNumber.replace(/\D/g, ""),
            expiryMonth: em,
            expiryYear: ey,
            cvv: cardCvv,
            cpf: profile.cpf,
            isDefault: savedCards.length === 0,
          });
        }
        await finalizeApprovedAppointment(profile.first_name, profile.last_name);
      } else {
        toast.success("Pagamento criado!", { description: "Aguardando confirmação." });
      }
    } catch (err: unknown) {
      logError("BookAppointment payment error", err);
      toastError(toast, err, "pagamento");
    } finally {
      setProcessing(false);
    }
  };

  // Pós-aprovação da consulta (compartilhado entre cartão novo e cartão salvo)
  const finalizeApprovedAppointment = async (firstName?: string, lastName?: string) => {
    if (!user || !doctor || !appointmentId) return;
    await db.from("appointments").update({
      payment_status: "approved",
      payment_confirmed_at: new Date().toISOString(),
    }).eq("id", appointmentId);

    triggerAppointmentConfirmed(appointmentId).catch(err => logError("triggerAppointmentConfirmed", err));
    const pName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
    const doctorFullName = `Dr(a). ${doctor.first_name} ${doctor.last_name}`;
    if (selectedDate && selectedTime) {
      notifyNewAppointment(appointmentId, doctor.id, pName, format(selectedDate, "dd/MM/yyyy", { locale: ptBR }), selectedTime)
        .catch(err => logError("notifyNewAppointment", err));
    }
    notifyPaymentConfirmed(user.id, doctorFullName, selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "", `R$ ${totalPrice.toFixed(2)}`)
      .catch(err => logError("notifyPaymentConfirmed", err));

    toast.success("Pagamento confirmado! ✅");
    navigate(`/dashboard/appointments/${appointmentId}/confirmed`);
  };

  // Pagamento em 1 toque com cartão salvo — respeita o termo (CFM) como o handlePayment
  const handleSavedCardPay = async (savedCardId: string, securityCode?: string) => {
    if (processing) return;
    if (!user || !doctor || !appointmentId) return;
    if (!consentDone) {
      pendingSavedPayRef.current = { savedCardId, securityCode };
      setConsentOpen(true);
      return;
    }
    setProcessing(true);
    try {
      const res = await chargeSavedCard({
        savedCardId,
        referenceId: `appointment_${appointmentId}`,
        description: "Consulta médica AloClínica",
        securityCode,
        couponCode: couponCode || undefined,
      });
      if (!res.ok) {
        toastError(toast, res.error || "pagamento_falhou", "pagamento");
        setProcessing(false);
        return;
      }
      if (res.status === "approved") {
        const { data: profile } = await db.from("profiles").select("first_name, last_name").eq("user_id", user.id).maybeSingle();
        await finalizeApprovedAppointment(profile?.first_name, profile?.last_name);
      } else if (res.status === "refused") {
        toast.error("Pagamento recusado", { description: res.message || "Tente outro cartão." });
        setProcessing(false);
      } else {
        toast.success("Pagamento em processamento", { description: "Aguardando confirmação." });
        setProcessing(false);
      }
    } catch (err) {
      logError("BookAppointment saved-card payment error", err);
      toastError(toast, err, "pagamento");
      setProcessing(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 16);
    return cleaned.replace(/(\d{4})/g, "$1 ").trim();
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length >= 3) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return cleaned;
  };

  const availableTimes = selectedDate ? getAvailableTimesForDate(selectedDate) : [];
  const upcomingSlots = getUpcomingSlots(5);

  // ── Cadastro rápido dialog ──
  const quickDialog = (
    <QuickPatientCheckoutDialog
      open={quickOpen}
      onOpenChange={setQuickOpen}
      onComplete={() => {
        setProfileReady(true);
        // continua o fluxo de reserva automaticamente
        setTimeout(() => handleBook(), 0);
      }}
    />
  );

  // ── Termo de consentimento da consulta ──
  const consentDialog = (
    <ConsentDialog
      open={consentOpen}
      onOpenChange={setConsentOpen}
      kind={consentKind}
      appointmentId={appointmentId}
      acceptLabel="Aceitar e prosseguir"
      onAccepted={() => {
        setConsentDone(true);
        const pending = pendingSavedPayRef.current;
        if (pending) {
          pendingSavedPayRef.current = null;
          setTimeout(() => handleSavedCardPay(pending.savedCardId, pending.securityCode), 0);
        } else {
          setTimeout(() => handlePayment(), 0);
        }
      }}
    />
  );

  if (loading) return (
    <DashboardLayout title="Paciente" nav={patientNav} role="patient">
      <div className="w-full max-w-lg mx-auto space-y-4 pb-24 md:pb-6">
        <div className="h-6 w-20 rounded-lg shimmer-v2" />
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-border/30">
          <div className="w-14 h-14 rounded-xl shimmer-v2" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded shimmer-v2" />
            <div className="h-3 w-28 rounded shimmer-v2" />
          </div>
          <div className="h-6 w-16 rounded shimmer-v2" />
        </div>
        <div className="flex items-center justify-between px-2">
          {[1,2,3,4].map(i => <div key={i} className="flex flex-col items-center gap-1"><div className="w-9 h-9 rounded-full shimmer-v2" /><div className="h-2 w-8 rounded shimmer-v2" /></div>)}
        </div>
        <div className="h-64 rounded-2xl shimmer-v2" />
      </div>
    </DashboardLayout>
  );

  if (!doctor) return (
    <DashboardLayout title="Paciente" nav={patientNav} role="patient">
      <div className="text-center py-20">
        <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">Médico não encontrado</p>
      </div>
    </DashboardLayout>
  );

  if (kycPending) {
    return (
      <DashboardLayout title="Paciente" nav={patientNav} role="patient">
        <div className="w-full max-w-lg mx-auto text-center py-20 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Verificação necessária</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Para sua segurança, você precisa concluir a verificação de identidade (KYC) antes de agendar consultas.
          </p>
          <Button onClick={() => navigate("/dashboard/profile?role=patient&kyc=open")} className="rounded-xl">
            <Shield className="w-4 h-4 mr-2" /> Completar verificação
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Paciente" nav={patientNav} role="patient">
      <div className="w-full max-w-2xl mx-auto pb-24 md:pb-6">
        {/* Back */}
        <button onClick={() => {
          if (paymentStep) { setPaymentStep(false); return; }
          navigate(-1);
        }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 active:scale-95 transition-transform">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="mb-5">
          <AppPromotionalBanners role="patient" placement="schedule" />
        </div>

        {/* Doctor card */}
        <div className="app-card mb-5 flex items-center gap-3 rounded-[30px] p-4">
          <Avatar className="w-14 h-14 rounded-xl shrink-0">
            <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary to-secondary text-white font-bold text-lg">
              {doctor.first_name[0]}{doctor.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-foreground text-[15px] truncate">Dr(a). {doctor.first_name} {doctor.last_name}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>CRM {doctor.crm}/{doctor.crm_state}</span>
              {doctor.rating > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-warning fill-warning" /> {doctor.rating.toFixed(1)}
                </span>
              )}
            </div>
            {doctor.specialties.length > 0 && (
              <div className="flex gap-1 mt-1.5">
                {doctor.specialties.slice(0, 2).map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{s}</span>
                ))}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-black text-foreground">R${totalPrice.toFixed(0)}</p>
            {totalPrice < fullPrice && (
              <p className="text-[10px] text-secondary line-through">R${fullPrice.toFixed(0)}</p>
            )}
            {returnEligible && (
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Retorno -{RETURN_DISCOUNT_PCT}%</p>
            )}
            <p className="text-[10px] text-muted-foreground">por consulta</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="app-glass-panel mb-6 flex items-center justify-between rounded-[28px] px-3 py-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <motion.div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                      isDone ? "bg-primary text-primary-foreground" :
                      isActive ? "bg-primary/15 text-primary ring-2 ring-primary/30" :
                      "bg-muted text-muted-foreground"
                    )}
                    animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    {isDone ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                        <Check className="w-4 h-4" />
                      </motion.div>
                    ) : <Icon className="w-4 h-4" />}
                  </motion.div>
                  <span className={cn(
                    "text-[10px] mt-1 font-medium",
                    isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-full h-0.5 -mt-4 bg-muted overflow-hidden rounded-full">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: i < currentStep ? "100%" : "0%" }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {/* Step 1: Date */}
          {currentStep === 0 && (
            <motion.div key="date" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="app-card rounded-[28px] p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" /> Escolha a data
              </h3>
              {upcomingSlots.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" /> Próximos horários
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {upcomingSlots.map(({ date, time }) => (
                      <button
                        key={`${date.toISOString()}-${time}`}
                        onClick={() => { setSelectedDate(date); setSelectedTime(time); }}
                        className="h-10 px-3 rounded-xl border border-primary/20 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 active:scale-95 transition-all"
                      >
                        {format(date, "EEE dd/MM", { locale: ptBR }).replace(".", "")} · {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Calendar
                mode="single" selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                disabled={(date) => !isDayAvailable(date)}
                fromDate={new Date()} toDate={addDays(new Date(), 60)}
                locale={ptBR} className="pointer-events-auto mx-auto"
              />
            </motion.div>
          )}

          {/* Step 2: Time */}
          {currentStep === 1 && selectedDate && (
            <motion.div key="time" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              <button onClick={() => { setSelectedDate(undefined); setSelectedTime(null); }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium active:scale-95 transition-transform">
                <CalendarDays className="w-4 h-4" />
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                <span className="text-primary/50 ml-1">✕</span>
              </button>

              <div className="app-card rounded-[28px] p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Horários disponíveis
                </h3>
                {availableTimes.length === 0 ? (
                  <div className="text-center py-10">
                    <Clock className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Sem horários nesta data</p>
                    <Button variant="outline" size="sm" className="mt-3 rounded-xl"
                      onClick={async () => {
                        const { error } = await db.from("appointment_waitlist").insert({
                          patient_id: user!.id, doctor_id: doctor.id,
                          desired_date: format(selectedDate, "yyyy-MM-dd"),
                        });
                        if (!error) toast.success("✅ Avisaremos você!", { description: "Se uma vaga abrir, você será notificado." });
                      }}>
                      🔔 Me avise se vagar
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {availableTimes.map(time => (
                      <Button key={time} variant={selectedTime === time ? "default" : "outline"}
                        onClick={() => setSelectedTime(time)}
                        className={cn("h-12 text-sm rounded-xl font-medium active:scale-95 transition-all",
                          selectedTime === time && "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-md scale-[1.02]"
                        )}>
                        {time}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirm */}
          {currentStep === 2 && selectedDate && selectedTime && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { setSelectedDate(undefined); setSelectedTime(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium active:scale-95 transition-transform">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {format(selectedDate, "dd/MM", { locale: ptBR })}
                  <span className="opacity-50">✕</span>
                </button>
                <button onClick={() => setSelectedTime(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium active:scale-95 transition-transform">
                  <Clock className="w-3.5 h-3.5" /> {selectedTime}h <span className="opacity-50">✕</span>
                </button>
              </div>

              <div className="app-card rounded-[30px] border-primary/20 p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" /> Confirmar Agendamento
                </h3>

                {dependents.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-1.5">Para quem é a consulta?</p>
                    <Select value={bookingFor} onValueChange={setBookingFor}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self"><span className="flex items-center gap-2"><UserPlus className="w-3.5 h-3.5" /> Para mim</span></SelectItem>
                        {dependents.map(dep => (
                          <SelectItem key={dep.id} value={dep.id}>
                            <span className="flex items-center gap-2"><UserCheck className="w-3.5 h-3.5" /> {dep.name} ({dep.relationship})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Retorno é oferecido só quando o paciente é elegível (consulta concluída
                    dentro do prazo de retorno). Sem jargão de "tipo de consulta": o padrão é
                    1ª consulta e nada é pedido ao paciente quando não há retorno disponível. */}
                {returnOffered && (
                  <div className="mb-4">
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3 cursor-pointer">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" /> É retorno?
                        </span>
                        <span className="block text-[12px] text-muted-foreground mt-0.5">
                          Consulta de acompanhamento com {RETURN_DISCOUNT_PCT}% de desconto.
                        </span>
                      </span>
                      <Switch
                        checked={appointmentType === "return"}
                        onCheckedChange={(on) => setAppointmentType(on ? "return" : "first_visit")}
                      />
                    </label>
                    {appointmentType === "return" && returnEligible && (
                      <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 shrink-0" /> Retorno com {RETURN_DISCOUNT_PCT}% de desconto aplicado.
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-muted/50 rounded-xl p-4 space-y-2.5 mb-5">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0" /> Dr(a). {doctor.first_name} {doctor.last_name}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0" /> {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0" /> {selectedTime}h
                  </div>
                  <div className="pt-2 border-t border-border/60 space-y-1 text-[12px]">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">R$ {fullPrice.toFixed(2)}</span>
                    </div>
                    {returnEligible && returnDiscountAmount > 0 && (
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                        <span className="inline-flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> Retorno (-{RETURN_DISCOUNT_PCT}%)
                        </span>
                        <span className="tabular-nums">- R$ {returnDiscountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {couponCode && couponDiscount > 0 && (
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                        <span className="inline-flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Cupom {couponCode} (-{couponDiscount}%)
                        </span>
                        <span className="tabular-nums">- R$ {couponAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 mt-1 border-t border-border/40 text-sm font-bold text-foreground">
                      <span>Total</span>
                      <span className="tabular-nums">R$ {totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Coupon */}
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-1.5 inline-flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Cupom de desconto
                  </p>
                  {couponCode ? (
                    <div className="flex items-center justify-between gap-2 h-11 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 truncate">
                          {couponCode}
                        </span>
                        <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] border-0">
                          -{couponDiscount}%
                        </Badge>
                      </div>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        aria-label="Remover cupom"
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Digite o código"
                        className="h-11 rounded-xl font-mono uppercase tracking-wider"
                        maxLength={20}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyCoupon();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={applyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="h-11 rounded-xl px-4 font-semibold shrink-0"
                      >
                        {couponLoading ? "..." : "Aplicar"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Só consultas avulsas — sem agendamento recorrente/pacote. */}

                <Button
                  className="w-full h-14 rounded-xl bg-gradient-to-r from-primary via-primary to-secondary text-primary-foreground text-base font-bold shadow-xl shadow-primary/20 hover:shadow-2xl transition-shadow active:scale-[0.98]"
                  onClick={handleBook} disabled={booking}>
                  {booking ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Reservando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Ir para Pagamento <ChevronRight className="w-5 h-5" />
                    </span>
                  )}
                </Button>

                <p className="text-[10px] text-center text-muted-foreground mt-3">
                  Ao confirmar, você concorda com os termos de uso e política de cancelamento.
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 4: Premium Payment Checkout */}
          {currentStep === 3 && paymentStep && (
            <motion.div key="payment" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-primary via-primary/90 to-secondary p-8 text-primary-foreground shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
                  <Shield className="w-32 h-32" />
                </div>
                <div className="relative z-10 flex flex-col items-center text-center">
                  <Badge className="mb-4 bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md px-4 py-1">
                    <Lock className="w-3 h-3 mr-2" /> Checkout Seguro
                  </Badge>
                  <h3 className="text-3xl font-black tracking-tight mb-2">Finalizar Agendamento</h3>
                  {totalPrice < fullPrice && (
                    <span className="text-sm font-medium line-through opacity-60">R$ {fullPrice.toFixed(2)}</span>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg opacity-80 font-medium">R$</span>
                    <span className="text-5xl font-black">{totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-sm opacity-90 font-medium bg-black/10 px-4 py-2 rounded-2xl">
                    <CalendarDays className="w-4 h-4" />
                    {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
                  </div>
                </div>
              </div>

              {/* Boleto oculto na telemedicina: a vaga expira em 30 min e o boleto leva até 2 dias úteis para compensar. */}
              <div className="app-glass-panel grid grid-cols-2 gap-3 rounded-[24px] p-1">
                {(["pix", "card"] as const).map((method) => {
                  const Icon = method === "pix" ? QrCode : method === "card" ? CreditCard : FileBarChart;
                  const active = paymentMethod === method;
                  return (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 py-4 rounded-xl transition-all duration-300 relative overflow-hidden group",
                        active ? "bg-white dark:bg-card shadow-xl scale-[1.02] border-primary/10 border" : "text-muted-foreground hover:bg-white/50 dark:hover:bg-card/30"
                      )}
                    >
                      {active && (
                        <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-secondary" />
                      )}
                      <Icon className={cn("w-6 h-6 transition-transform duration-500", active ? "text-primary scale-110" : "group-hover:scale-110")} />
                      <span className={cn("text-xs font-bold uppercase tracking-wider", active ? "text-primary" : "text-muted-foreground")}>
                        {method === "pix" ? "PIX" : method === "card" ? "Cartão" : "Boleto"}
                      </span>
                      {method === "pix" && !active && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-secondary rounded-full animate-ping" />
                      )}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={paymentMethod}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  {paymentMethod === "pix" && (
                    <Card className="border-border/40 shadow-2xl rounded-3xl overflow-hidden bg-card/50 backdrop-blur-xl">
                      <CardContent className="p-8 text-center">
                        {pixExpired ? (
                          <div className="py-8">
                            <div className="w-20 h-20 mx-auto rounded-3xl bg-destructive/10 flex items-center justify-center mb-6">
                              <XIcon className="w-10 h-10 text-destructive" />
                            </div>
                            <h4 className="text-xl font-bold mb-2">QR Code Expirado</h4>
                            <p className="text-muted-foreground mb-8">O código PIX tem validade de 30 minutos.</p>
                            <Button
                              className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
                              onClick={() => { setPixQrCode(null); handlePayment(); }}
                              disabled={processing}
                            >
                              {processing ? <Loader2 className="animate-spin mr-2" /> : <Clock className="w-5 h-5 mr-2" />}
                              Gerar Novo PIX
                            </Button>
                          </div>
                        ) : pixQrCode ? (
                          <div className="space-y-6">
                            <div className="relative group mx-auto w-64 h-64">
                              <div className="absolute inset-0 bg-primary/10 rounded-[2rem] blur-2xl group-hover:bg-primary/20 transition-colors" />
                              <div className="relative bg-white p-4 rounded-[2rem] shadow-xl border border-white/20">
                                <img
                                  src={`data:image/png;base64,${pixQrCode}`}
                                  alt="QR Code PIX"
                                  className="w-full h-full rounded-2xl"
                                />
                              </div>
                            </div>

                            <div className={cn(
                              "inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold shadow-inner transition-colors",
                              pixSecondsLeft < 120 ? "bg-destructive/10 text-destructive animate-pulse" : "bg-secondary/10 text-secondary"
                            )}>
                              <Clock className="w-4 h-4" />
                              Expira em {Math.floor(pixSecondsLeft / 60)}:{(pixSecondsLeft % 60).toString().padStart(2, '0')}
                            </div>

                            <div className="space-y-3">
                              <p className="text-sm font-medium text-muted-foreground">Pague agora para confirmar na hora</p>
                              <Button
                                variant="secondary"
                                className="w-full h-14 rounded-2xl font-bold text-base shadow-lg shadow-secondary/10 hover:shadow-secondary/20 transition-all active:scale-[0.98]"
                                onClick={() => {
                                  navigator.clipboard.writeText(pixCopyPaste || "");
                                  setPixCopied(true);
                                  toast.success("Código copiado!");
                                  setTimeout(() => setPixCopied(false), 3000);
                                }}
                              >
                                {pixCopied ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <Copy className="w-5 h-5 mr-2" />}
                                {pixCopied ? "Copiado!" : "Copiar Código Copia e Cola"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8">
                            <div className="w-20 h-20 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
                              <QrCode className="w-10 h-10 text-primary" />
                            </div>
                            <h4 className="text-xl font-bold mb-2">Pagar com PIX</h4>
                            <p className="text-muted-foreground mb-8">Confirmação instantânea e segura.</p>
                            <Button
                              className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
                              onClick={handlePayment}
                              disabled={processing}
                            >
                              {processing ? <Loader2 className="animate-spin mr-2" /> : <QrCode className="w-5 h-5 mr-2" />}
                              Gerar QR Code PIX
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {paymentMethod === "card" && (
                    savedCardsLoading ? (
                      <Card className="border-border/40 shadow-2xl rounded-3xl overflow-hidden bg-card/50 backdrop-blur-xl">
                        <CardContent className="p-8">
                          <div className="h-16 rounded-2xl bg-muted animate-pulse" />
                        </CardContent>
                      </Card>
                    ) : savedCards.length > 0 && !useNewCard && !returnEligible ? (
                      <Card className="border-border/40 shadow-2xl rounded-3xl overflow-hidden bg-card/50 backdrop-blur-xl">
                        <CardContent className="p-8 space-y-4">
                          <div>
                            <h4 className="text-lg font-bold">Pagar em 1 toque</h4>
                            <p className="text-sm text-muted-foreground">Escolha um cartão salvo para pagar na hora.</p>
                          </div>
                          <SavedCardCheckout
                            cards={savedCards}
                            payLabel="PAGAR AGORA"
                            payClassName="h-16 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-lg shadow-xl shadow-primary/20"
                            processing={processing}
                            onPay={handleSavedCardPay}
                            onUseNewCard={() => setUseNewCard(true)}
                          />
                        </CardContent>
                      </Card>
                    ) : (
                    <Card className="border-border/40 shadow-2xl rounded-3xl overflow-hidden bg-card/50 backdrop-blur-xl">
                      <CardContent className="p-8 space-y-6">
                        <div className="relative h-44 w-full rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white shadow-xl overflow-hidden">
                          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                          <div className="relative z-10 flex flex-col justify-between h-full">
                            <div className="flex justify-between items-start">
                              <div className="w-12 h-8 bg-gradient-to-br from-amber-400 to-amber-200 rounded-md opacity-80" />
                              <CreditCard className="w-8 h-8 opacity-40" />
                            </div>
                            <div className="space-y-4">
                              <div className="text-xl font-mono tracking-[0.2em]">
                                {cardNumber || "•••• •••• •••• ••••"}
                              </div>
                              <div className="flex justify-between text-xs font-mono uppercase tracking-widest opacity-70">
                                <div>{cardName || "NOME DO TITULAR"}</div>
                                <div>{cardExpiry || "MM/AA"}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Titular</Label>
                            <Input
                              value={cardName}
                              onChange={e => setCardName(e.target.value)}
                              placeholder="Nome impresso no cartão"
                              className="h-14 rounded-2xl border-border/40 bg-background/50 focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Número do Cartão</Label>
                            <div className="relative">
                              <Input
                                value={cardNumber}
                                onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                                placeholder="0000 0000 0000 0000"
                                className="h-14 rounded-2xl border-border/40 bg-background/50 font-mono text-lg tracking-wider pr-12"
                                maxLength={19}
                              />
                              <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground/40" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Validade</Label>
                              <Input
                                value={cardExpiry}
                                onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                                placeholder="MM/AA"
                                className="h-14 rounded-2xl border-border/40 bg-background/50 font-mono text-center"
                                maxLength={5}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">CVC</Label>
                              <div className="relative">
                                <Input
                                  value={cardCvv}
                                  onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                  placeholder="•••"
                                  className="h-14 rounded-2xl border-border/40 bg-background/50 font-mono text-center"
                                  maxLength={4}
                                  type="password"
                                />
                                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-2xl border border-border/40 p-3">
                          <Label className="text-sm font-normal cursor-pointer">Salvar cartão para a próxima vez</Label>
                          <Switch checked={saveCardNext} onCheckedChange={setSaveCardNext} />
                        </div>

                        <Button
                          className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-lg shadow-xl shadow-primary/20 transition-all active:scale-[0.98] mt-4"
                          onClick={handlePayment}
                          disabled={processing}
                        >
                          {processing ? <Loader2 className="animate-spin mr-2" /> : <Shield className="w-6 h-6 mr-2" />}
                          PAGAR AGORA
                        </Button>

                        {savedCards.length > 0 && !returnEligible && (
                          <Button type="button" variant="ghost" className="w-full rounded-2xl" onClick={() => setUseNewCard(false)}>
                            Voltar aos cartões salvos
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                    )
                  )}

                  {paymentMethod === "boleto" && (
                    <Card className="border-border/40 shadow-2xl rounded-3xl overflow-hidden bg-card/50 backdrop-blur-xl">
                      <CardContent className="p-8 text-center">
                        {boletoUrl ? (
                          <div className="py-8">
                            <div className="w-20 h-20 mx-auto rounded-3xl bg-secondary/10 flex items-center justify-center mb-6">
                              <CheckCircle2 className="w-10 h-10 text-secondary" />
                            </div>
                            <h4 className="text-xl font-bold mb-2">Boleto Gerado com Sucesso!</h4>
                            <p className="text-muted-foreground mb-8 text-sm">Após o pagamento, a compensação pode levar até 2 dias úteis.</p>
                            <a href={boletoUrl} target="_blank" rel="noopener noreferrer" className="block">
                              <Button className="w-full h-14 rounded-2xl bg-secondary hover:bg-secondary/90 text-white font-bold shadow-lg shadow-secondary/20">
                                <FileBarChart className="w-5 h-5 mr-2" /> Visualizar Boleto
                              </Button>
                            </a>
                          </div>
                        ) : (
                          <div className="py-8">
                            <div className="w-20 h-20 mx-auto rounded-3xl bg-muted flex items-center justify-center mb-6">
                              <FileBarChart className="w-10 h-10 text-muted-foreground" />
                            </div>
                            <h4 className="text-xl font-bold mb-2">Boleto Bancário</h4>
                            <p className="text-muted-foreground mb-8 text-sm">Pague em qualquer banco ou casa lotérica.</p>
                            <Button
                              className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                              onClick={handlePayment}
                              disabled={processing}
                            >
                              {processing ? <Loader2 className="animate-spin mr-2" /> : <FileBarChart className="w-5 h-5 mr-2" />}
                              Gerar Boleto
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Security badges */}
              <div className="flex items-center justify-center gap-4 mt-4 text-muted-foreground">
                <div className="flex items-center gap-1 text-xs"><Lock className="w-3 h-3" /> SSL 256-bit</div>
                <div className="flex items-center gap-1 text-xs"><Shield className="w-3 h-3" /> PCI DSS</div>
                <div className="flex items-center gap-1 text-xs"><Check className="w-3 h-3" /> LGPD</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {quickDialog}
      {consentDialog}
    </DashboardLayout>
  );
};

export default BookAppointment;

