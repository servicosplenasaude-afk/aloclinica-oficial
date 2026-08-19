import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getPatientNav } from "./patientNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Zap, Phone, RefreshCw, AlertTriangle, QrCode, CreditCard, FileBarChart, Lock, Copy, CheckCircle2, Shield, MapPin, Ambulance, ChevronRight, Building2, Navigation, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/errorMessages";
import { motion, AnimatePresence } from "framer-motion";
import { notifyDoctorsNewQueueEntry } from "@/lib/notifications-queue";
import { logError } from "@/lib/logger";
import { validateCard } from "@/lib/card-utils";
import { useSavedCards } from "@/components/billing/useSavedCards";
import SavedCardCheckout, { chargeSavedCard } from "@/components/billing/SavedCardCheckout";
import mascotWave from "@/assets/mascot-wave.png";
import ConsentDialog from "@/components/legal/ConsentDialog";

type PaymentMethod = "pix" | "card" | "boleto";

// Sinais de alarme (red-flags): se algum for marcado, é emergência → SAMU 192,
// NÃO a fila paga de teleconsulta.
const RED_FLAGS = [
  "Dor ou aperto no peito",
  "Falta de ar intensa / dificuldade para respirar",
  "Sinais de AVC (boca torta, fraqueza súbita, fala enrolada)",
  "Desmaio ou perda de consciência",
  "Sangramento intenso que não para",
  "Dor de cabeça súbita e muito forte",
  "Convulsão",
  "Pensamentos de se machucar",
];

interface NearbyHospital {
  name: string;
  distance: string;
  distanceMeters: number;
  driveMin: number;
  lat: number;
  lon: number;
}

/** Calculate distance between two lat/lon points in meters (Haversine) */
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

/** Fetch hospitals near coords using OpenStreetMap Overpass API (free, no key needed) */
const fetchNearbyHospitals = async (lat: number, lon: number): Promise<NearbyHospital[]> => {
  const radius = 10000; // 10 km
  const query = `[out:json][timeout:10];(node["amenity"="hospital"](around:${radius},${lat},${lon});way["amenity"="hospital"](around:${radius},${lat},${lon}););out center 20;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error("Overpass API error");
  const data = await res.json();
  
  const hospitals: NearbyHospital[] = (data.elements || [])
    .map((el: any) => {
      const hLat = el.lat ?? el.center?.lat;
      const hLon = el.lon ?? el.center?.lon;
      const name = el.tags?.name;
      if (!name || !hLat || !hLon) return null;
      const dist = haversine(lat, lon, hLat, hLon);
      const driveMin = Math.max(1, Math.round(dist / 500)); // rough estimate ~30km/h city
      return { name, distance: formatDistance(dist), distanceMeters: dist, driveMin, lat: hLat, lon: hLon };
    })
    .filter(Boolean)
    .sort((a: NearbyHospital, b: NearbyHospital) => a.distanceMeters - b.distanceMeters)
    .slice(0, 6);
  
  return hospitals;
};

const FIRST_AID_TIPS = [
  "Permaneça no local e tente monitorar a respiração do paciente continuamente até a ajuda chegar.",
  "Não ofereça água ou alimentos. Mantenha as vias aéreas livres e o paciente confortável.",
  "Se houver sangramento, aplique pressão firme com um pano limpo.",
];

const UrgentCareQueue = () => {
  const { user } = useAuth();
  const [shiftInfo, setShiftInfo] = useState<{ shift: string; price: number; label: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [myEntry, setMyEntry] = useState<{ id: string; status: string; position?: number; created_at: string; payment_id?: string } | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const [showPayment, setShowPayment] = useState(false);
  const [showTriage, setShowTriage] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [triageComplaint, setTriageComplaint] = useState("");
  const [redFlags, setRedFlags] = useState<Set<string>>(new Set());
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
  const [pendingQueueId, setPendingQueueId] = useState<string | null>(null);
  // Cartões salvos (vault MP) — pagar em 1 toque
  const { cards: savedCards, addCard, loading: savedCardsLoading } = useSavedCards();
  const [useNewCard, setUseNewCard] = useState(false);
  const [saveCardNext, setSaveCardNext] = useState(false);
  // PIX expiry countdown (15 minutes = 900s)
  const PIX_EXPIRY_SECS = 900;
  const [pixSecondsLeft, setPixSecondsLeft] = useState(PIX_EXPIRY_SECS);
  const [pixExpired, setPixExpired] = useState(false);
  const [nearbyHospitals, setNearbyHospitals] = useState<NearbyHospital[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [hasDiscountCard, setHasDiscountCard] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);

  // Check discount card on mount
  useEffect(() => {
    if (!user) return;
    db
      .from("discount_cards")
      .select("discount_percent, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setHasDiscountCard(true);
          setDiscountPercent(data.discount_percent ?? 30);
        }
      });
  }, [user]);

  // Fetch nearby hospitals via geolocation + Overpass
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocalização não suportada pelo navegador");
      setHospitalsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lon: longitude });
        try {
          const hospitals = await fetchNearbyHospitals(latitude, longitude);
          setNearbyHospitals(hospitals);
        } catch (err) {
          logError("Failed to fetch nearby hospitals", err);
          setLocationError("Não foi possível buscar hospitais próximos");
        } finally {
          setHospitalsLoading(false);
        }
      },
      (err) => {
        setLocationError(err.code === 1 ? "Permita o acesso à localização para ver hospitais próximos" : "Erro ao obter localização");
        setHospitalsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const openInMaps = (hospital: NearbyHospital) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lon}`;
    window.open(url, "_blank");
  };

  useEffect(() => { fetchShiftPrice(); if (user) fetchMyEntry(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = db.channel("urgent-care-queue").on("postgres_changes", { event: "*", schema: "public", table: "on_demand_queue", filter: `patient_id=eq.${user.id}` }, () => fetchMyEntry()).subscribe();
    return () => { db.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!myEntry || myEntry.status !== "waiting") return;
    const interval = setInterval(() => { setElapsed(Math.floor((Date.now() - new Date(myEntry.created_at).getTime()) / 1000)); }, 1000);
    return () => clearInterval(interval);
  }, [myEntry]);

  useEffect(() => {
    if (!showPayment || !pendingQueueId) return;
    const hasPending = pixQrCode || boletoUrl;
    if (!hasPending) return;
    const poll = setInterval(async () => {
      const { data } = await db.from("on_demand_queue").select("status, payment_id").eq("id", pendingQueueId).single();
      if (data && data.payment_id && data.status === "waiting") {
        clearInterval(poll);
        toast.success("✅ Pagamento confirmado! Você está na fila.");
        setShowPayment(false); setPixQrCode(null); setPixCopyPaste(null); setBoletoUrl(null);
        fetchMyEntry();
      }
    }, 8000);
    return () => clearInterval(poll);
  }, [showPayment, pendingQueueId, pixQrCode, boletoUrl]);

  // PIX expiry countdown — runs when QR code is shown
  useEffect(() => {
    if (!pixQrCode) { setPixSecondsLeft(PIX_EXPIRY_SECS); setPixExpired(false); return; }
    setPixSecondsLeft(PIX_EXPIRY_SECS);
    setPixExpired(false);
    const timer = setInterval(() => {
      setPixSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setPixExpired(true);
          toast.error("PIX expirado", { description: "O QR Code expirou. Gere um novo para continuar." });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pixQrCode]);

  const fetchShiftPrice = async () => {
    try { const { data } = await db.functions.invoke("calculate-shift-price"); if (data) setShiftInfo(data); } catch { setShiftInfo({ shift: "day", price: 75, label: "Diurno" }); }
    setLoading(false);
  };

  const fetchMyEntry = async () => {
    if (!user) return;
    const { data } = await db.from("on_demand_queue").select("*").eq("patient_id", user.id).in("status", ["waiting", "assigned", "in_progress"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) setMyEntry({ id: data.id, status: data.status, position: data.position ?? undefined, created_at: data.created_at, payment_id: data.payment_id ?? undefined });
    if (data?.status === "waiting") {
      const { count } = await db.from("on_demand_queue").select("*", { count: "exact", head: true }).eq("status", "waiting").lt("created_at", data.created_at);
      setQueuePosition((count ?? 0) + 1);
    }
    if (data?.status === "in_progress" && data?.appointment_id) window.location.href = `/dashboard/consultation/${data.appointment_id}?role=patient`;
  };

  const priceWithDiscount = shiftInfo
    ? hasDiscountCard && discountPercent > 0
      ? shiftInfo.price * (1 - discountPercent / 100)
      : shiftInfo.price
    : 0;
  const handleStartPayment = () => setShowPayment(true);

  const toggleRedFlag = (f: string) =>
    setRedFlags((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });

  // Após a triagem: se há sinal de alarme → tela de emergência (192); senão segue o pagamento.
  const handleTriageContinue = () => {
    if (redFlags.size > 0) {
      setEmergency(true);
      return;
    }
    setShowTriage(false);
    handleStartPayment();
  };

  // Aceite do termo de pronto-atendimento — bloqueia o "Entrar na Fila"
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentDone, setConsentDone] = useState(false);
  const handleEnterQueue = () => {
    if (!consentDone) { setConsentOpen(true); return; }
    handleStartPayment();
  };

  const handlePayment = async () => {
    if (processing) return; // Guard double-submit
    if (!user || !shiftInfo) return;
    if (paymentMethod === "card") { const cardError = validateCard(cardName, cardNumber, cardExpiry, cardCvv); if (cardError) { toast.error(cardError); return; } }
    setProcessing(true);
    try {
      const { data: profile } = await db.from("profiles").select("first_name, last_name, cpf, phone").eq("user_id", user.id).single();
      if (!profile?.cpf) { toast.error("CPF obrigatório", { description: "Complete seu perfil com o CPF antes de pagar." }); setProcessing(false); return; }
      const methodMap: Record<PaymentMethod, "pix" | "credit_card" | "boleto"> = { pix: "pix", card: "credit_card", boleto: "boleto" };
      const { data: queueEntry, error: queueError } = await db.from("on_demand_queue").insert({ patient_id: user.id, shift: shiftInfo.shift, price: priceWithDiscount, status: "pending_payment" } as any).select("id").single();
      if (queueError || !queueEntry) { toast.error("Erro ao reservar lugar na fila"); setProcessing(false); return; }
      setPendingQueueId(queueEntry.id);
      const payload: Record<string, any> = {
        amount: priceWithDiscount,
        payment_method: methodMap[paymentMethod],
        reference_id: `queue_${queueEntry.id}`,
        description: `Plantão 24h - AloClínica (${shiftInfo.label})`,
      };
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
          await db.from("on_demand_queue").delete().eq("id", queueEntry.id); setProcessing(false); return;
        }
      }
      const { data, error } = await db.functions.invoke("mercadopago-create-payment", { body: payload });
      if (error || !data?.payment_id || data?.error) { toast.error("Erro no pagamento", { description: data?.error || error?.message || "Tente novamente." }); await db.from("on_demand_queue").delete().eq("id", queueEntry.id); setProcessing(false); return; }
      if (paymentMethod === "pix") { setPixQrCode(data.qr_code_base64 || null); setPixCopyPaste(data.qr_code || null); setProcessing(false); toast.success("PIX gerado! 🎉"); return; }
      if (paymentMethod === "boleto") { setBoletoUrl(data.boleto_url || null); setProcessing(false); toast.success("Boleto gerado! 📄"); return; }
      if (data.status === "approved") {
        if (saveCardNext) {
          const [em, ey] = cardExpiry.split("/");
          await addCard({ holder: cardName, number: cardNumber.replace(/\D/g, ""), expiryMonth: em, expiryYear: ey, cvv: cardCvv, cpf: profile.cpf, isDefault: savedCards.length === 0 });
        }
        await db.from("on_demand_queue").update({ status: "waiting", payment_id: data.payment_id } as any).eq("id", queueEntry.id);
        toast.success("Pagamento confirmado! Você está na fila. 🚀"); setShowPayment(false);
        notifyDoctorsNewQueueEntry(profile.first_name || "Paciente", shiftInfo.shift, priceWithDiscount);
        fetchMyEntry();
      } else { toast.success("Pagamento criado!", { description: "Aguardando confirmação." }); }
    } catch (err: unknown) { logError("UrgentCareQueue payment error", err); toast.error("Erro", { description: err instanceof Error ? err.message : "Erro inesperado." }); }
    finally { setProcessing(false); }
  };

  // Pagamento em 1 toque com cartão salvo. Consentimento já foi aceito antes da tela de pagamento.
  const handleSavedCardPay = async (savedCardId: string, securityCode?: string) => {
    if (processing || !user || !shiftInfo) return;
    setProcessing(true);
    try {
      const { data: profile } = await db.from("profiles").select("first_name, last_name, cpf").eq("user_id", user.id).single();
      if (!profile?.cpf) { toast.error("CPF obrigatório", { description: "Complete seu perfil com o CPF antes de pagar." }); setProcessing(false); return; }
      const { data: queueEntry, error: queueError } = await db.from("on_demand_queue").insert({ patient_id: user.id, shift: shiftInfo.shift, price: priceWithDiscount, status: "pending_payment" } as any).select("id").single();
      if (queueError || !queueEntry) { toast.error("Erro ao reservar lugar na fila"); setProcessing(false); return; }
      const res = await chargeSavedCard({ savedCardId, referenceId: `queue_${queueEntry.id}`, description: `Plantão 24h - AloClínica (${shiftInfo.label})`, securityCode });
      if (!res.ok) { toast.error("Erro no pagamento", { description: res.error }); await db.from("on_demand_queue").delete().eq("id", queueEntry.id); setProcessing(false); return; }
      if (res.status === "approved") {
        await db.from("on_demand_queue").update({ status: "waiting", payment_id: res.payment_id } as any).eq("id", queueEntry.id);
        toast.success("Pagamento confirmado! Você está na fila. 🚀"); setShowPayment(false);
        notifyDoctorsNewQueueEntry(profile.first_name || "Paciente", shiftInfo.shift, priceWithDiscount);
        fetchMyEntry();
      } else if (res.status === "refused") {
        toast.error("Pagamento recusado", { description: res.message || "Tente outro cartão." });
        await db.from("on_demand_queue").delete().eq("id", queueEntry.id);
      } else {
        toast.success("Pagamento em processamento", { description: "Aguardando confirmação." });
      }
    } catch (err: unknown) { logError("UrgentCareQueue saved-card payment error", err); toast.error("Erro", { description: err instanceof Error ? err.message : "Erro inesperado." }); }
    finally { setProcessing(false); }
  };

  const handleRequestRefund = async () => {
    if (!myEntry || refunding) return;
    setRefunding(true);
    try {
      // Sem cobrança associada (entrada sem pagamento): apenas sai da fila.
      if (!myEntry.payment_id) {
        await db.from("on_demand_queue").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", myEntry.id);
        toast.success("Você saiu da fila."); setMyEntry(null); return;
      }
      // Estorno REAL no Mercado Pago (a função valida dono + janela de 24h e
      // devolve o dinheiro de fato; antes só marcávamos status='refunded').
      const { data, error } = await db.functions.invoke("mercadopago-refund", { body: { mp_payment_id: myEntry.payment_id } });
      // Mensagem de erro pode vir no corpo (200 c/ error) ou no context da resposta 4xx.
      let errMsg: string | null = (data as { error?: string } | null)?.error ?? null;
      if (!errMsg && error) {
        errMsg = error.message;
        try { const b = await (error as { context?: Response }).context?.json?.(); if (b?.error) errMsg = b.error; } catch { /* ignora */ }
      }
      if ((data as { ok?: boolean } | null)?.ok) {
        toast.success("Estorno realizado com sucesso.", { description: "O valor será devolvido pelo Mercado Pago em alguns dias úteis." });
        setMyEntry(null); return;
      }
      // "Já estornado" é sucesso do ponto de vista do paciente.
      if (errMsg && /já estornad|em processamento|em andamento/i.test(errMsg)) {
        toast.success("Estorno já processado."); setMyEntry(null); return;
      }
      toast.error("Não foi possível estornar", { description: errMsg || "Tente novamente ou fale com o suporte." });
    } catch (err: unknown) {
      logError("UrgentCareQueue refund error", err);
      toast.error("Erro no estorno", { description: err instanceof Error ? err.message : "Tente novamente." });
    } finally {
      setRefunding(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const formatCardNum = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})/g, "$1 ").trim();
  const formatExp = (v: string) => { const c = v.replace(/\D/g, "").slice(0, 4); return c.length >= 3 ? `${c.slice(0, 2)}/${c.slice(2)}` : c; };

  return (
    <DashboardLayout title="Paciente" nav={getPatientNav("urgent-care")}>
      {showTriage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
            {emergency ? (
              <div className="p-6 text-center">
                <Ambulance className="w-12 h-12 mx-auto text-[#A32D2D] mb-3" />
                <h3 className="text-xl font-extrabold text-foreground mb-2">Isto pode ser uma emergência</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Pelos sinais que você marcou, procure atendimento <b>presencial imediato</b>. A teleconsulta <b>não substitui</b> a emergência.
                </p>
                <a href="tel:192" className="w-full h-12 rounded-full bg-[#A32D2D] text-white font-bold flex items-center justify-center gap-2 mb-2 no-underline">
                  <Phone className="w-4 h-4" /> Ligar 192 (SAMU)
                </a>
                <p className="text-xs text-muted-foreground mb-3">
                  Ou vá ao pronto-socorro mais próximo{nearbyHospitals[0] ? `: ${nearbyHospitals[0].name} (${nearbyHospitals[0].distance})` : ""}.
                </p>
                <Button variant="ghost" className="w-full rounded-full" onClick={() => { setShowTriage(false); setEmergency(false); setRedFlags(new Set()); }}>
                  Voltar
                </Button>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <h3 className="font-bold text-foreground">Triagem rápida</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Antes de entrar na fila, marque se você tem algum destes sinais graves:</p>
                <div className="space-y-2 mb-4">
                  {RED_FLAGS.map((f) => (
                    <label key={f} className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/40">
                      <input type="checkbox" className="mt-1" checked={redFlags.has(f)} onChange={() => toggleRedFlag(f)} />
                      <span className="text-sm text-foreground">{f}</span>
                    </label>
                  ))}
                </div>
                <Label className="text-sm">Qual o seu principal sintoma?</Label>
                <Input value={triageComplaint} onChange={(e) => setTriageComplaint(e.target.value)} placeholder="Ex.: febre e dor de garganta" className="mt-1 mb-4" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-full" onClick={() => { setShowTriage(false); setRedFlags(new Set()); }}>Cancelar</Button>
                  <Button className="flex-1 rounded-full bg-primary text-primary-foreground font-bold" onClick={handleTriageContinue}>Continuar</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="w-full max-w-5xl mx-auto pb-24 md:pb-6">
        {loading ? (
          <div className="space-y-5" aria-label="Carregando fila">
            <div className="rounded-[30px] border border-border p-6">
              <Skeleton className="h-10 w-10 rounded-full mx-auto mb-3" />
              <Skeleton className="h-5 w-40 mx-auto mb-3" />
              <Skeleton className="h-12 w-24 mx-auto mb-2" />
              <Skeleton className="h-4 w-28 mx-auto mb-5" />
              <Skeleton className="h-2 w-full max-w-xs mx-auto mb-5 rounded-full" />
              <Skeleton className="h-11 w-full rounded-full" />
            </div>
          </div>
        ) : myEntry ? (
          /* ═══ IN QUEUE ═══ */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Queue position card - amber tinted */}
            <div className="relative overflow-hidden rounded-[30px] border border-warning/25 bg-[linear-gradient(135deg,#fff7df_0%,#ffffff_52%,#eef7ff_100%)] p-6 text-center shadow-[0_24px_70px_-46px_rgba(15,42,90,.72)]">
              {myEntry.status === "waiting" && (
                <>
                  <Clock className="w-10 h-10 mx-auto text-warning mb-3 animate-pulse" />
                  <h2 className="text-lg font-bold text-foreground font-[Manrope] mb-1">Você está na fila</h2>
                  <p className="font-[Manrope] text-[48px] font-extrabold text-[hsl(var(--p-primary))] leading-none mb-1 tabular-nums">{queuePosition}º</p>
                  <p className="text-sm text-muted-foreground mb-4">posição na fila</p>
                  {/* Animated progress bar */}
                  <div className="w-full max-w-xs mx-auto mb-4">
                    <Progress value={Math.min((elapsed / 900) * 100, 100)} className="h-2" />
                  </div>
                  <Badge variant="outline" className="text-lg px-4 py-1 mb-4 font-[Manrope] font-bold tabular-nums">{formatTime(elapsed)}</Badge>
                  <p className="text-xs text-muted-foreground mb-5">Tempo de espera</p>
                  {elapsed > 900 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-center gap-2 text-destructive mb-2"><AlertTriangle className="w-4 h-4" /><span className="text-sm font-medium">Espera acima de 15 minutos</span></div>
                      <Button variant="destructive" className="rounded-full" onClick={handleRequestRefund} disabled={refunding}>{refunding ? "Estornando…" : "Solicitar Reembolso"}</Button>
                    </div>
                  )}
                  <Button variant="outline" onClick={() => fetchMyEntry()} className="mt-2 rounded-full"><RefreshCw className="w-4 h-4 mr-1" /> Atualizar</Button>
                </>
              )}
              {myEntry.status === "assigned" && (<><Phone className="w-12 h-12 mx-auto text-[hsl(var(--p-primary))] mb-4" /><h2 className="text-xl font-bold mb-2 font-[Manrope]">Médico encontrado!</h2><p className="text-muted-foreground mb-4">Aguarde, a consulta começará em instantes...</p></>)}
              {myEntry.status === "in_progress" && (<><RefreshCw className="w-12 h-12 mx-auto text-[hsl(var(--p-primary))] mb-4 animate-spin" /><h2 className="text-xl font-bold mb-2 font-[Manrope]">Conectando você ao médico…</h2><p className="text-muted-foreground mb-4">Sua sala de consulta está sendo aberta. Você será levado(a) automaticamente.</p><Button variant="outline" onClick={() => fetchMyEntry()} className="rounded-full"><RefreshCw className="w-4 h-4 mr-1" /> Atualizar</Button></>)}
            </div>
          </motion.div>
        ) : showPayment ? (
          /* ═══ PAYMENT ═══ */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="mb-6 overflow-hidden rounded-[30px] border-white/60 bg-[linear-gradient(135deg,#f7fbff_0%,#ffffff_58%,#fff6f7_100%)] shadow-[0_24px_70px_-46px_rgba(15,42,90,.72)]">
              <CardContent className="p-5 md:p-6">
                <div className="text-center mb-6">
                  <Lock className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                  <h2 className="text-lg font-bold text-foreground font-[Manrope]">Pagamento — Plantão 24h</h2>
                  <p className="text-muted-foreground text-sm">R$ {priceWithDiscount.toFixed(2)} • Turno {shiftInfo?.label}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {([{ id: "pix" as PaymentMethod, label: "PIX", icon: QrCode, badge: "Instantâneo" }, { id: "card" as PaymentMethod, label: "Cartão", icon: CreditCard, badge: null }, { id: "boleto" as PaymentMethod, label: "Boleto", icon: FileBarChart, badge: null }]).map(method => (
                    <motion.button key={method.id} whileTap={{ scale: 0.97 }} onClick={() => setPaymentMethod(method.id)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-3xl border transition-all ${paymentMethod === method.id ? "border-[hsl(var(--p-primary))] bg-white shadow-sm ring-4 ring-primary/10" : "border-white/70 bg-white/70 hover:border-[hsl(var(--p-primary))]/30"}`}>
                      <method.icon className={`w-5 h-5 ${paymentMethod === method.id ? "text-[hsl(var(--p-primary))]" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-semibold ${paymentMethod === method.id ? "text-[hsl(var(--p-primary))]" : "text-foreground"}`}>{method.label}</span>
                      {method.badge && <Badge className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0 bg-secondary text-secondary-foreground border-0">{method.badge}</Badge>}
                    </motion.button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  {paymentMethod === "pix" && (
                    <motion.div key="pix" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                      {pixQrCode ? (
                        <>
                          {/* QR Code with expiry overlay */}
                          <div className="relative w-48 h-48 mx-auto mb-4">
                            <div className={`rounded-2xl bg-card border-2 p-2 w-full h-full ${pixExpired ? "border-destructive/40 opacity-40" : "border-border"}`}>
                              <img src={`data:image/png;base64,${pixQrCode}`} alt="QR Code PIX" className="w-full h-full object-contain rounded-xl" />
                            </div>
                            {pixExpired && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm">
                                <p className="text-sm font-bold text-destructive">PIX Expirado</p>
                                <Button size="sm" className="mt-2 rounded-full bg-[hsl(var(--p-primary))] text-white" onClick={() => { setPixQrCode(null); setPixCopyPaste(null); }}>
                                  Gerar novo PIX
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Countdown badge */}
                          {!pixExpired && (
                            <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold mb-3 ${pixSecondsLeft < 120 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                              <Clock className="w-3 h-3" />
                              Expira em {Math.floor(pixSecondsLeft / 60).toString().padStart(2, "0")}:{(pixSecondsLeft % 60).toString().padStart(2, "0")}
                            </div>
                          )}

                          {!pixExpired && (
                            <>
                              <Button variant="outline" className="w-full mb-4 text-xs rounded-2xl" onClick={() => { navigator.clipboard.writeText(pixCopyPaste || ""); setPixCopied(true); toast.success("Copiado!"); setTimeout(() => setPixCopied(false), 3000); }}>
                                {pixCopied ? <><CheckCircle2 className="w-4 h-4 mr-2 text-secondary" /> Copiado!</> : <><Copy className="w-4 h-4 mr-2" /> Copiar código PIX</>}
                              </Button>
                              <p className="text-xs text-muted-foreground">Após o pagamento, você entrará na fila automaticamente.</p>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <QrCode className="w-12 h-12 mx-auto text-[hsl(var(--p-primary))]/60 mb-4" />
                          <Button className="w-full bg-[hsl(var(--p-primary))] text-white h-12 rounded-2xl" onClick={handlePayment} disabled={processing}>
                            {processing ? "Gerando PIX..." : `Gerar PIX • R$ ${priceWithDiscount.toFixed(2)}`}
                          </Button>
                        </>
                      )}
                    </motion.div>
                  )}
                  {paymentMethod === "card" && (
                    <motion.div key="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      {savedCardsLoading ? (
                        <div className="h-16 rounded-2xl bg-muted animate-pulse" />
                      ) : savedCards.length > 0 && !useNewCard ? (
                        <SavedCardCheckout
                          cards={savedCards}
                          payLabel={`Pagar R$ ${priceWithDiscount.toFixed(2)}`}
                          payClassName="bg-[hsl(var(--p-primary))] text-white"
                          processing={processing}
                          onPay={handleSavedCardPay}
                          onUseNewCard={() => setUseNewCard(true)}
                        />
                      ) : (
                        <>
                          <div><Label className="text-xs">Nome no cartão</Label><Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Nome no cartão" className="mt-1 rounded-2xl h-11" /></div>
                          <div><Label className="text-xs">Número</Label><Input value={cardNumber} onChange={e => setCardNumber(formatCardNum(e.target.value))} placeholder="0000 0000 0000 0000" className="mt-1 font-mono rounded-2xl h-11" maxLength={19} /></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div><Label className="text-xs">Validade</Label><Input value={cardExpiry} onChange={e => setCardExpiry(formatExp(e.target.value))} placeholder="MM/AA" className="mt-1 font-mono rounded-2xl h-11" maxLength={5} /></div>
                            <div><Label className="text-xs">CVV</Label><Input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="•••" className="mt-1 font-mono rounded-2xl h-11" maxLength={4} type="password" /></div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-border/40 p-3">
                            <Label className="text-xs font-normal cursor-pointer">Salvar cartão para a próxima vez</Label>
                            <Switch checked={saveCardNext} onCheckedChange={setSaveCardNext} />
                          </div>
                          <Button className="w-full bg-[hsl(var(--p-primary))] text-white h-12 rounded-2xl" onClick={handlePayment} disabled={processing}>{processing ? "Processando..." : <><Lock className="w-4 h-4 mr-2" /> Pagar R$ {priceWithDiscount.toFixed(2)}</>}</Button>
                          {savedCards.length > 0 && (
                            <Button type="button" variant="ghost" className="w-full h-11 rounded-2xl" onClick={() => setUseNewCard(false)}>Voltar aos cartões salvos</Button>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                  {paymentMethod === "boleto" && (
                    <motion.div key="boleto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                      {boletoUrl ? (<><CheckCircle2 className="w-12 h-12 mx-auto text-secondary mb-4" /><a href={boletoUrl} target="_blank" rel="noopener noreferrer"><Button className="w-full rounded-2xl">📄 Abrir Boleto</Button></a><p className="text-xs text-muted-foreground mt-3">Após compensação, você entrará na fila automaticamente.</p></>) : (<><FileBarChart className="w-12 h-12 mx-auto text-[hsl(var(--p-primary))]/60 mb-4" /><Button className="w-full bg-[hsl(var(--p-primary))] text-white h-12 rounded-2xl" onClick={handlePayment} disabled={processing}>{processing ? "Gerando..." : `Gerar Boleto • R$ ${priceWithDiscount.toFixed(2)}`}</Button></>)}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex items-center justify-center gap-2 mt-5 text-xs text-muted-foreground"><Shield className="w-3 h-3" /> Pagamento seguro via Mercado Pago</div>
                <Button variant="ghost" onClick={() => setShowPayment(false)} className="w-full mt-3 text-sm text-muted-foreground rounded-2xl">Voltar</Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* ═══ MAIN VIEW ═══ */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Red gradient urgency banner */}
            <div className="relative overflow-hidden rounded-[32px] border border-white/15 bg-[linear-gradient(135deg,#9f1f32_0%,#f05a56_55%,#ffb35f_100%)] p-5 text-white shadow-[0_28px_80px_-44px_rgba(163,45,45,.78)] md:p-7">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,.22),transparent_30%),radial-gradient(circle_at_92%_18%,rgba(255,255,255,.16),transparent_24%)]" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 mb-3">
                  <Zap className="w-3 h-3 text-white" />
                  <span className="text-[11px] font-bold text-white/80 tracking-wide">Urgência 24h</span>
                </div>
                <h1 className="text-2xl font-extrabold text-white mb-1 font-[Manrope]">Urgência e Emergência</h1>
                <p className="text-sm text-white/70 mb-2">Consulta com médico plantonista em minutos.</p>
                <p className="font-[Manrope] text-[32px] font-extrabold text-white leading-none tabular-nums mb-1">
                  R$ {priceWithDiscount.toFixed(2)}
                </p>
                {shiftInfo && (
                  <p className="text-sm text-white/70 mb-4">
                    Turno <span className="font-semibold text-white/90">{shiftInfo.label}</span>
                  </p>
                )}
                <Button
                  className="h-12 rounded-full bg-white px-5 font-black text-[#A32D2D] shadow-[0_12px_34px_rgba(80,10,18,.22)] hover:bg-white/90 gap-2"
                  onClick={handleEnterQueue}
                >
                  <Zap className="w-4 h-4" /> Entrar na Fila
                </Button>
              </div>
              <img src={mascotWave} alt="Pingo" className="absolute right-0 bottom-0 w-36 h-36 object-contain drop-shadow-2xl md:w-44 md:h-44" loading="lazy" decoding="async" width={176} height={176} />
            </div>

            {/* Pricing tiers */}
            <div className="rounded-[28px] border border-border/45 bg-card/95 p-4 shadow-sm">
              <p className="text-xs font-black text-muted-foreground mb-3 uppercase tracking-[0.16em]">Tabela de valores por turno</p>
              <div className="grid gap-2 md:grid-cols-3">
                {[
                  { label: "Diurno", range: "07–19h", price: 75 },
                  { label: "Noturno", range: "19–00h", price: 100 },
                  { label: "Madrugada", range: "00–07h", price: 120 },
                ].map((tier) => {
                  const isActive = shiftInfo?.label === tier.label;
                  return (
                    <div
                      key={tier.label}
                      className={`flex items-center justify-between rounded-2xl border px-3 py-3 text-sm transition-colors ${isActive ? "border-primary/25 bg-primary/10" : "border-border/30 bg-muted/25"}`}
                    >
                      <span className={`font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>{`${tier.label} ${tier.range}`}</span>
                      <span className={`font-bold tabular-nums ${isActive ? "text-primary" : "text-foreground"}`}>{`R$ ${tier.price}`}</span>
                    </div>
                  );
                })}
              </div>
              {hasDiscountCard && (
                <p className="mt-2 text-xs text-secondary font-medium">
                  Cartão Saúde ativo — {discountPercent}% de desconto aplicado
                </p>
              )}
            </div>

            {/* Nearby clinics count */}
            <div className="flex items-center gap-2 mb-1 rounded-full border border-secondary/15 bg-secondary/5 px-3 py-2">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
              <span className="text-sm font-bold text-foreground">
                {hospitalsLoading ? "Buscando hospitais..." : `${nearbyHospitals.length} Hospitais Próximos`}
              </span>
            </div>

            {/* Emergency triage */}
            <div className="rounded-[28px] border border-warning/25 bg-[linear-gradient(135deg,#fff8e6_0%,#ffffff_100%)] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <h3 className="font-bold text-foreground font-[Manrope]">Relatar Emergência</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">Uma triagem rápida separa emergências (que precisam do 192) da teleconsulta.</p>
              <Button className="h-12 rounded-full bg-[#A32D2D] text-white w-full font-bold shadow-[0_12px_30px_rgba(163,45,45,0.20)]" onClick={() => { setEmergency(false); setShowTriage(true); }}>
                Iniciar Triagem
              </Button>
            </div>

            {/* Hospitals - real data from geolocation */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-1 font-[Manrope]">Hospitais Próximos</h2>
              <p className="text-xs text-muted-foreground mb-3">
                {hospitalsLoading ? "Obtendo sua localização..." : "Baseado na sua localização atual"}
              </p>

              {hospitalsLoading && (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Buscando hospitais próximos...</span>
                </div>
              )}

              {locationError && !hospitalsLoading && (
                <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 text-center">
                  <MapPin className="w-6 h-6 text-warning mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium mb-1">Localização indisponível</p>
                  <p className="text-xs text-muted-foreground">{locationError}</p>
                </div>
              )}

              {!hospitalsLoading && !locationError && nearbyHospitals.length === 0 && (
                <div className="rounded-2xl border border-border/20 bg-muted/30 p-4 text-center">
                  <Building2 className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum hospital encontrado nas proximidades</p>
                </div>
              )}

              <div className="space-y-3">
                {nearbyHospitals.map((h, i) => (
                  <motion.div key={`${h.lat}-${h.lon}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => openInMaps(h)}
                    className="p-4 rounded-2xl border border-border/20 bg-card flex items-center gap-4 shadow-[var(--p-shadow-card)] hover:shadow-[var(--p-shadow-elevated)] transition-shadow cursor-pointer">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0">
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">{h.distance} de distância</p>
                      <p className="font-semibold text-foreground text-sm truncate">{h.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Navigation className="w-3 h-3 text-primary" /> ~{h.driveMin} min de carro</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* First aid tips */}
            <div className="rounded-2xl bg-muted/30 border border-border/20 p-5">
              <h3 className="font-bold text-foreground mb-3 flex items-center gap-2 font-[Manrope]">🩹 O que fazer agora?</h3>
              <div className="space-y-3">
                {FIRST_AID_TIPS.map((tip, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-sm font-bold text-[hsl(var(--p-primary))] shrink-0 font-[Manrope]">{String(i + 1).padStart(2, "0")}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
      <ConsentDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        kind="telemed_ondemand"
        acceptLabel="Aceitar e entrar na fila"
        onAccepted={() => { setConsentDone(true); setTimeout(() => handleStartPayment(), 0); }}
      />
    </DashboardLayout>
  );
};

export default UrgentCareQueue;
