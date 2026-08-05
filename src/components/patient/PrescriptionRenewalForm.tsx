import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getPatientNav } from "./patientNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useSavedCards } from "@/components/billing/useSavedCards";
import SavedCardCheckout, { chargeSavedCard } from "@/components/billing/SavedCardCheckout";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  FileBarChart,
  FileText,
  Lock,
  Pill,
  QrCode,
  Shield,
  Sparkles,
  Upload,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type PaymentMethod = "pix" | "card" | "boleto";
const RENEWAL_PRICE = 80;

const PrescriptionRenewalForm = () => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prescriptionUrl, setPrescriptionUrl] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [sideEffects, setSideEffects] = useState("");
  const [notes, setNotes] = useState("");
  const [myRenewals, setMyRenewals] = useState<any[]>([]);

  const [showPayment, setShowPayment] = useState(false);
  const [renewalId, setRenewalId] = useState<string | null>(null);
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
  // Cartões salvos (vault MP) — pagar em 1 toque
  const { cards: savedCards, addCard, loading: savedCardsLoading } = useSavedCards();
  const [useNewCard, setUseNewCard] = useState(false);
  const [saveCardNext, setSaveCardNext] = useState(false);

  const finalPrice = RENEWAL_PRICE;

  useEffect(() => {
    if (user) fetchRenewals();
  }, [user]);

  const fetchRenewals = async () => {
    if (!user) return;
    const { data } = await db
      .from("prescription_renewals")
      .select("*")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false });
    setMyRenewals(data ?? []);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande", { description: "O tamanho maximo e 10MB." });
      return;
    }

    setUploading(true);
    const filePath = `${user.id}/renewal-${Date.now()}-${file.name}`;
    const { error } = await db.storage.from("patient-documents").upload(filePath, file);

    if (error) toast.error("Erro no upload", { description: error.message });
    else {
      setPrescriptionUrl(filePath);
      toast.success("Receita enviada");
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!user || !prescriptionUrl) {
      toast.error("Envie a receita vencida primeiro");
      return;
    }

    setSubmitting(true);
    const questionnaire = {
      allergies: allergies.trim(),
      chronic_conditions: conditions.trim(),
      current_medications: medications.trim(),
      side_effects: sideEffects.trim(),
      additional_notes: notes.trim(),
    };

    const { data, error } = await db.from("prescription_renewals").insert({
      patient_id: user.id,
      original_prescription_url: prescriptionUrl,
      health_questionnaire: questionnaire,
      status: "pending_payment",
    }).select("id").single();

    if (error) toast.error("Erro", { description: error.message });
    else {
      setRenewalId(data.id);
      setShowPayment(true);
      toast.info("Agora finalize o pagamento para enviar ao medico.");
    }
    setSubmitting(false);
  };

  const handlePayment = async () => {
    if (processing || !user || !renewalId) return;
    if (paymentMethod === "card" && (!cardName || !cardNumber || !cardExpiry || !cardCvv)) {
      toast.error("Preencha todos os campos do cartao");
      return;
    }

    setProcessing(true);
    try {
      const { data: profile } = await db.from("profiles").select("first_name, last_name, cpf, phone").eq("user_id", user.id).single();
      if (!profile?.cpf) {
        toast.error("CPF obrigatorio");
        setProcessing(false);
        return;
      }

      const methodMap: Record<PaymentMethod, "pix" | "credit_card" | "boleto"> = {
        pix: "pix",
        card: "credit_card",
        boleto: "boleto",
      };
      const payload: Record<string, any> = {
        amount: finalPrice,
        payment_method: methodMap[paymentMethod],
        reference_id: `renewal_${renewalId}`,
        description: "Renovacao de Receita - AloClinica",
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
          toast.error("Erro no cartao", { description: e instanceof Error ? e.message : String(e) });
          setProcessing(false);
          return;
        }
      }

      const { data, error } = await db.functions.invoke("mercadopago-create-payment", { body: payload });
      if (error || !data?.payment_id || data?.error) {
        toast.error("Erro no pagamento", { description: data?.error || error?.message });
        setProcessing(false);
        return;
      }

      if (paymentMethod === "pix") {
        setPixQrCode(data.qr_code_base64 || null);
        setPixCopyPaste(data.qr_code || "");
        setProcessing(false);
        toast.success("PIX gerado");
        return;
      }

      if (paymentMethod === "boleto") {
        setBoletoUrl(data.boleto_url || null);
        setProcessing(false);
        toast.success("Boleto gerado");
        return;
      }

      if (data.status === "approved") {
        if (saveCardNext) {
          const [em, ey] = cardExpiry.split("/");
          await addCard({ holder: cardName, number: cardNumber.replace(/\D/g, ""), expiryMonth: em, expiryYear: ey, cvv: cardCvv, cpf: profile.cpf, isDefault: savedCards.length === 0 });
        }
        await db.from("prescription_renewals").update({
          paid_at: new Date().toISOString(),
          // "pending" = paid & awaiting a doctor (what RenewalQueue reads).
          status: "pending",
          payment_id: data.payment_id,
        } as any).eq("id", renewalId);
        toast.success("Pagamento confirmado", { description: "Um medico analisara sua receita em breve." });
        resetForm();
        fetchRenewals();
      }
    } catch (err: unknown) {
      toast.error("Erro", { description: err instanceof Error ? err.message : "Erro inesperado" });
    } finally {
      setProcessing(false);
    }
  };

  // Pagamento em 1 toque com cartão salvo (sem termo de consentimento neste fluxo)
  const handleSavedCardPay = async (savedCardId: string, securityCode?: string) => {
    if (processing || !user || !renewalId) return;
    setProcessing(true);
    try {
      const res = await chargeSavedCard({ savedCardId, referenceId: `renewal_${renewalId}`, description: "Renovacao de Receita - AloClinica", securityCode });
      if (!res.ok) { toast.error("Erro no pagamento", { description: res.error }); return; }
      if (res.status === "approved") {
        await db.from("prescription_renewals").update({
          paid_at: new Date().toISOString(),
          // "pending" = paid & awaiting a doctor (what RenewalQueue reads).
          status: "pending",
          payment_id: res.payment_id,
        } as any).eq("id", renewalId);
        toast.success("Pagamento confirmado", { description: "Um medico analisara sua receita em breve." });
        resetForm();
        fetchRenewals();
      } else if (res.status === "refused") {
        toast.error("Pagamento recusado", { description: res.message || "Tente outro cartao." });
      } else {
        toast.success("Pagamento em processamento", { description: "Aguardando confirmacao." });
      }
    } catch (err: unknown) {
      toast.error("Erro", { description: err instanceof Error ? err.message : "Erro inesperado" });
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setShowPayment(false);
    setRenewalId(null);
    setPrescriptionUrl("");
    setAllergies("");
    setConditions("");
    setMedications("");
    setSideEffects("");
    setNotes("");
    setPixQrCode(null);
    setPixCopyPaste(null);
    setBoletoUrl(null);
  };

  const formatCardNum = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})/g, "$1 ").trim();
  const formatExp = (v: string) => {
    const c = v.replace(/\D/g, "").slice(0, 4);
    return c.length >= 3 ? `${c.slice(0, 2)}/${c.slice(2)}` : c;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending_payment":
        return <Badge variant="outline" className="rounded-full"><Clock className="mr-1 h-3 w-3" />Aguardando pagamento</Badge>;
      case "pending":
      case "pending_review":
        return <Badge variant="outline" className="rounded-full"><Clock className="mr-1 h-3 w-3" />Em analise</Badge>;
      case "in_review":
        return <Badge className="rounded-full bg-warning text-warning-foreground"><AlertCircle className="mr-1 h-3 w-3" />Em analise</Badge>;
      case "approved":
        return <Badge className="rounded-full bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3 w-3" />Aprovada</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="rounded-full"><XCircle className="mr-1 h-3 w-3" />Rejeitada</Badge>;
      default:
        return <Badge variant="outline" className="rounded-full">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout title="Paciente" nav={getPatientNav("renewal")}>
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-24 md:pb-8">
        <section className="relative overflow-hidden rounded-[34px] border border-white/60 bg-[linear-gradient(135deg,#fff4f8_0%,#ffffff_48%,#effff8_100%)] p-5 shadow-[0_26px_80px_-50px_rgba(90,24,70,.55)] md:p-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-rose-300/18 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-20 h-44 w-44 rounded-full bg-emerald-300/16 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/75 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Analise medica
              </div>
              <h1 className="font-[Manrope] text-2xl font-black text-foreground md:text-3xl">Renovar Receita</h1>
              <p className="mt-1 text-sm text-muted-foreground">Envie sua receita vencida, responda o questionario e acompanhe a analise pelo app.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
              <div className="rounded-2xl border border-white/65 bg-white/75 p-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Valor</p>
                <p className="mt-1 text-lg font-black text-foreground">R$ {finalPrice.toFixed(2).replace(".", ",")}</p>
              </div>
              <div className="rounded-2xl border border-white/65 bg-white/75 p-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Prazo</p>
                <p className="mt-1 text-lg font-black text-foreground">3 dias</p>
              </div>
            </div>
          </div>
        </section>

        {!showPayment ? (
          <Card className="overflow-hidden rounded-[30px] border-border/40 bg-card/95 shadow-sm">
            <CardContent className="space-y-6 p-5 md:p-6">
              <div className="rounded-[26px] border border-dashed border-primary/25 bg-primary/5 p-4">
                <Label className="text-sm font-black text-foreground">1. Envie a receita vencida</Label>
                <p className="mt-1 text-xs text-muted-foreground">Aceitamos PDF, JPG e PNG com ate 10MB.</p>
                <div className="mt-3">
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
                  <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="h-11 rounded-full px-5 font-bold">
                    <Upload className="mr-2 h-4 w-4" /> {uploading ? "Enviando..." : prescriptionUrl ? "Receita enviada" : "Escolher arquivo"}
                  </Button>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <Pill className="h-5 w-5" />
                  </div>
                  <div>
                    <Label className="text-sm font-black text-foreground">2. Questionario de saude</Label>
                    <p className="text-xs text-muted-foreground">Essas respostas ajudam o medico a avaliar com seguranca.</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="rx-allergies" className="text-xs font-bold text-muted-foreground">Alergias conhecidas</Label>
                    <Input id="rx-allergies" value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="Ex: Dipirona, Penicilina" className="mt-1 h-11 rounded-2xl" />
                  </div>
                  <div>
                    <Label htmlFor="rx-conditions" className="text-xs font-bold text-muted-foreground">Condicoes cronicas</Label>
                    <Input id="rx-conditions" value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Ex: Hipertensao, diabetes" className="mt-1 h-11 rounded-2xl" />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="rx-medications" className="text-xs font-bold text-muted-foreground">Medicamentos atuais</Label>
                    <Textarea id="rx-medications" value={medications} onChange={e => setMedications(e.target.value)} placeholder="Liste os medicamentos em uso" rows={2} className="mt-1 rounded-2xl" />
                  </div>
                  <div>
                    <Label htmlFor="rx-side-effects" className="text-xs font-bold text-muted-foreground">Efeitos colaterais</Label>
                    <Input id="rx-side-effects" value={sideEffects} onChange={e => setSideEffects(e.target.value)} placeholder="Algum efeito recente?" className="mt-1 h-11 rounded-2xl" />
                  </div>
                  <div>
                    <Label htmlFor="rx-notes" className="text-xs font-bold text-muted-foreground">Observacoes</Label>
                    <Textarea id="rx-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Informacoes extras" rows={2} className="mt-1 rounded-2xl" />
                  </div>
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={submitting || !prescriptionUrl} className="h-12 w-full rounded-full bg-[hsl(var(--p-primary))] font-bold text-white shadow-[var(--p-shadow-btn)]">
                {submitting ? "Enviando..." : <>Prosseguir para pagamento <ArrowRight className="ml-1 h-4 w-4" /></>}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Analise em ate 3 dias uteis apos pagamento.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-[30px] border-border/40 bg-card/95 shadow-sm">
            <CardContent className="p-5 md:p-6">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Lock className="h-5 w-5" />
                </div>
                <h2 className="font-[Manrope] text-xl font-black text-foreground">Pagamento da Renovacao</h2>
                <p className="text-sm text-muted-foreground">R$ {RENEWAL_PRICE},00 via Mercado Pago</p>
              </div>

              <div className="mb-5 grid grid-cols-3 gap-2">
                {([
                  { id: "pix" as PaymentMethod, label: "PIX", icon: QrCode, badge: "Rapido" },
                  { id: "card" as PaymentMethod, label: "Cartao", icon: CreditCard, badge: null },
                  { id: "boleto" as PaymentMethod, label: "Boleto", icon: FileBarChart, badge: null },
                ]).map(method => (
                  <motion.button key={method.id} whileTap={{ scale: 0.97 }} onClick={() => setPaymentMethod(method.id)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 transition-all ${
                      paymentMethod === method.id ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/30"
                    }`}>
                    <method.icon className={`h-5 w-5 ${paymentMethod === method.id ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-xs font-bold ${paymentMethod === method.id ? "text-primary" : "text-foreground"}`}>{method.label}</span>
                    {method.badge && <Badge className="absolute -right-2 -top-2 border-0 bg-secondary px-1.5 py-0 text-[10px] text-secondary-foreground">{method.badge}</Badge>}
                  </motion.button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {paymentMethod === "pix" && (
                  <motion.div key="pix" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                    {pixQrCode ? (
                      <>
                        <div className="mx-auto mb-4 h-48 w-48 rounded-2xl border-2 border-border bg-card p-2">
                          <img src={`data:image/png;base64,${pixQrCode}`} alt="QR Code PIX" className="h-full w-full rounded-xl object-contain" loading="lazy" decoding="async" />
                        </div>
                        <Button variant="outline" className="mb-4 h-11 w-full rounded-full text-xs font-bold" onClick={() => { navigator.clipboard.writeText(pixCopyPaste || ""); setPixCopied(true); toast.success("Copiado"); setTimeout(() => setPixCopied(false), 3000); }}>
                          {pixCopied ? <><CheckCircle2 className="mr-2 h-4 w-4 text-secondary" /> Copiado</> : <><Copy className="mr-2 h-4 w-4" /> Copiar codigo PIX</>}
                        </Button>
                        <p className="text-xs text-muted-foreground">Apos o pagamento, sua solicitacao sera enviada automaticamente.</p>
                      </>
                    ) : (
                      <>
                        <QrCode className="mx-auto mb-4 h-12 w-12 text-primary/60" />
                        <Button className="h-12 w-full rounded-full bg-[hsl(var(--p-primary))] font-bold text-white shadow-[var(--p-shadow-btn)]" onClick={handlePayment} disabled={processing}>
                          {processing ? "Gerando PIX..." : `Gerar PIX - R$ ${finalPrice.toFixed(2).replace(".", ",")}`}
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
                        payLabel={`Pagar R$ ${finalPrice.toFixed(2).replace(".", ",")}`}
                        payClassName="rounded-full bg-[hsl(var(--p-primary))] text-white shadow-[var(--p-shadow-btn)]"
                        processing={processing}
                        onPay={handleSavedCardPay}
                        onUseNewCard={() => setUseNewCard(true)}
                      />
                    ) : (
                      <>
                        <div><Label className="text-xs font-bold text-muted-foreground">Nome no cartao</Label><Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Nome no cartao" className="mt-1 h-11 rounded-2xl" /></div>
                        <div><Label className="text-xs font-bold text-muted-foreground">Numero</Label><Input value={cardNumber} onChange={e => setCardNumber(formatCardNum(e.target.value))} placeholder="0000 0000 0000 0000" className="mt-1 h-11 rounded-2xl font-mono" maxLength={19} /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label className="text-xs font-bold text-muted-foreground">Validade</Label><Input value={cardExpiry} onChange={e => setCardExpiry(formatExp(e.target.value))} placeholder="MM/AA" className="mt-1 h-11 rounded-2xl font-mono" maxLength={5} /></div>
                          <div><Label className="text-xs font-bold text-muted-foreground">CVV</Label><Input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="***" className="mt-1 h-11 rounded-2xl font-mono" maxLength={4} type="password" /></div>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-border/40 p-3">
                          <Label className="text-xs font-normal cursor-pointer">Salvar cartao para a proxima vez</Label>
                          <Switch checked={saveCardNext} onCheckedChange={setSaveCardNext} />
                        </div>
                        <Button className="h-12 w-full rounded-full bg-[hsl(var(--p-primary))] font-bold text-white shadow-[var(--p-shadow-btn)]" onClick={handlePayment} disabled={processing}>
                          {processing ? "Processando..." : <><Lock className="mr-2 h-4 w-4" /> Pagar R$ {finalPrice.toFixed(2).replace(".", ",")}</>}
                        </Button>
                        {savedCards.length > 0 && (
                          <Button type="button" variant="ghost" className="h-11 w-full rounded-full" onClick={() => setUseNewCard(false)}>Voltar aos cartoes salvos</Button>
                        )}
                      </>
                    )}
                  </motion.div>
                )}

                {paymentMethod === "boleto" && (
                  <motion.div key="boleto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                    {boletoUrl ? (
                      <><CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-secondary" /><a href={boletoUrl} target="_blank" rel="noopener noreferrer"><Button className="h-11 w-full rounded-full font-bold">Abrir boleto</Button></a></>
                    ) : (
                      <><FileBarChart className="mx-auto mb-4 h-12 w-12 text-primary/60" /><Button className="h-12 w-full rounded-full bg-[hsl(var(--p-primary))] font-bold text-white shadow-[var(--p-shadow-btn)]" onClick={handlePayment} disabled={processing}>
                        {processing ? "Gerando boleto..." : `Gerar boleto - R$ ${finalPrice.toFixed(2).replace(".", ",")}`}
                      </Button></>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-5 flex items-center justify-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1 text-xs"><Lock className="h-3 w-3" /> SSL</div>
                <div className="flex items-center gap-1 text-xs"><Shield className="h-3 w-3" /> PCI</div>
                <div className="flex items-center gap-1 text-xs"><Check className="h-3 w-3" /> LGPD</div>
              </div>
            </CardContent>
          </Card>
        )}

        {myRenewals.length > 0 && (
          <Card className="rounded-[30px] border-border/40 bg-card/95 shadow-sm">
            <CardContent className="p-5 md:p-6">
              <h3 className="mb-4 font-[Manrope] text-lg font-black text-foreground">Minhas solicitacoes</h3>
              <div className="space-y-3">
                {myRenewals.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-[22px] border border-border/40 bg-muted/15 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                        {r.rejection_reason && <p className="truncate text-xs text-destructive">{r.rejection_reason}</p>}
                      </div>
                    </div>
                    {statusBadge(r.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PrescriptionRenewalForm;
