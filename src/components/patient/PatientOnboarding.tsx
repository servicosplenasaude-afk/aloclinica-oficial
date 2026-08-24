import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, Upload, FileText, Heart, Video, ArrowRight, ArrowLeft, X, Sparkles, User, Droplets, AlertTriangle, Plus, Stethoscope, Ambulance, ClipboardList, ShieldCheck, Camera, CheckCircle2, Smartphone, Monitor } from "lucide-react";
import KycCrossDevice from "@/components/kyc/KycCrossDevice";
import CpfInput from "@/components/ui/cpf-input";
import { useIsMobile } from "@/hooks/use-mobile";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import { toast } from "sonner";
import mascotWelcome from "@/assets/states/pingo-onboarding-paciente.webp";
import { formatMask } from "@/hooks/use-mask";
import { validarCPF } from "@/lib/form-validators";
import { IS_DEV } from "@/lib/constants";

const ONBOARDING_KEY = "aloclinica_onboarding_completed";
const KYC_PENDING_KEY = "aloclinica_kyc_pending";

interface PatientOnboardingProps {
  onComplete: () => void;
}

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Não sei"];
const COMMON_ALLERGIES = ["Dipirona", "Penicilina", "Amendoim", "Lactose", "Glúten", "Frutos do mar", "AAS"];
const COMMON_CONDITIONS = ["Diabetes", "Hipertensão", "Asma", "Depressão", "Ansiedade", "Tireoide", "Colesterol alto"];

const PatientOnboarding = ({ onComplete }: PatientOnboardingProps) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);

  // Pull initial values from auth metadata so we never start empty after signup
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const initialFirst = profile?.first_name || meta.first_name || (meta.full_name ? meta.full_name.split(" ")[0] : "") || "";
  const initialLast = profile?.last_name || meta.last_name || (meta.full_name ? meta.full_name.split(" ").slice(1).join(" ") : "") || "";
  const initialCpf = profile?.cpf || meta.cpf || "";
  const initialPhone = profile?.phone || meta.phone || "";
  const initialDob = profile?.date_of_birth || meta.date_of_birth || "";

  // Profile data
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [cpf, setCpf] = useState(initialCpf);
  const [phone, setPhone] = useState(initialPhone);
  const [dateOfBirth, setDateOfBirth] = useState(initialDob);
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState("");
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState("");
  const [kycCompleted, setKycCompleted] = useState(false);
  const [kycFailed, setKycFailed] = useState(false);
  const [kycReady, setKycReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    db.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (!data) return;
      // Only fill fields that are still empty so we don't overwrite user edits
      setFirstName((v) => v || data.first_name || "");
      setLastName((v) => v || data.last_name || "");
      setCpf((v) => v || data.cpf || "");
      setPhone((v) => v || data.phone || "");
      setDateOfBirth((v) => v || data.date_of_birth || "");
      setBloodType((v) => v || data.blood_type || "");
      setAllergies((v) => (v.length ? v : data.allergies || []));
      setChronicConditions((v) => (v.length ? v : data.chronic_conditions || []));
    });
  }, [user]);

  const cpfMasked = formatMask(cpf, "cpf");
  const phoneMasked = formatMask(phone, "phone");

  const STEPS = [
    { id: "welcome", title: "Bem-vindo(a)!" },
    { id: "personal", title: "Confirme seus dados" },
    { id: "kyc", title: "Verificação de Identidade" },
    { id: "tour", title: "Como usar" },
    { id: "done", title: "Tudo pronto!" },
  ];

  const isLast = currentStep === STEPS.length - 1;
  const step = STEPS[currentStep];

  // Identity fields are considered prefilled when all four come from signup/profile
  const rawCpfInit = (initialCpf || "").replace(/\D/g, "");
  const rawPhoneInit = (initialPhone || "").replace(/\D/g, "");
  const identityPrefilled =
    !!initialFirst && !!initialLast &&
    rawCpfInit.length === 11 && validarCPF(rawCpfInit) &&
    rawPhoneInit.length >= 10 &&
    !!initialDob;

  const addAllergy = () => {
    const v = allergyInput.trim();
    if (v && !allergies.includes(v)) { setAllergies(prev => [...prev.filter(x => x !== "Nenhuma"), v]); setAllergyInput(""); }
  };
  const addCondition = () => {
    const v = conditionInput.trim();
    if (v && !chronicConditions.includes(v)) { setChronicConditions(prev => [...prev.filter(x => x !== "Nenhuma"), v]); setConditionInput(""); }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    await db.from("profiles").update({
      first_name: firstName, last_name: lastName,
      cpf: cpf.replace(/\D/g, ""), phone: phone.replace(/\D/g, ""),
      date_of_birth: dateOfBirth || null, blood_type: bloodType || null,
      allergies, chronic_conditions: chronicConditions,
    }).eq("user_id", user.id);
    setSaving(false);
  };

   const markAsCompleted = async () => {
     localStorage.setItem(ONBOARDING_KEY, "true");
     // Sinaliza ao FirstConsultationTour para não abrir logo após o onboarding
     // (evita dois tours em sequência). O tour consome/remove esta flag.
     localStorage.setItem("alo_onboarding_just_done", "true");
     localStorage.removeItem(KYC_PENDING_KEY);
     if (user) {
       await db.auth.updateUser({
         data: { onboarding_completed: true }
       });
     }
     onComplete();
   };
 
   const handleNext = async () => {
    if (step.id === "personal") {
      if (!firstName.trim() || !lastName.trim()) { toast.error("Preencha nome e sobrenome"); return; }
      const rawCpf = cpf.replace(/\D/g, "");
      if (!rawCpf || !validarCPF(rawCpf)) { toast.error("CPF obrigatório", { description: "Informe um CPF válido para continuar." }); return; }
      const rawPhone = phone.replace(/\D/g, "");
      if (!rawPhone || rawPhone.length < 10) { toast.error("Telefone obrigatório", { description: "Informe um telefone válido." }); return; }
      if (!dateOfBirth) { toast.error("Data de nascimento obrigatória"); return; }
      // Age validation (16+)
      const today = new Date();
      const birth = new Date(dateOfBirth);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 16) { toast.error("Idade mínima: 16 anos"); return; }
      // Health fields are now optional — patient can complete later from the dashboard
      await saveProfile();
    }
    if (step.id === "kyc" && !kycCompleted) {
      toast.error("Verificação obrigatória", { description: "Complete a verificação de identidade para continuar." });
      return;
    }
     if (isLast) { await markAsCompleted(); }
    else setCurrentStep(prev => prev + 1);
  };

  const FEATURES = [
    { icon: <Stethoscope className="w-6 h-6 text-primary" />, title: "Consultas Médicas", desc: "Agende especialistas em poucos cliques." },
    { icon: <ClipboardList className="w-6 h-6 text-secondary" />, title: "Histórico", desc: "Seu prontuário sempre à mão." },
    { icon: <Ambulance className="w-6 h-6 text-destructive" />, title: "Emergência", desc: "Atendimento 24h prioritário." },
  ];

  const renderStep = () => {
    switch (step.id) {
      case "welcome":
        return (
          <div className="text-center px-2 pt-2">
            {/* Mascot stage with halo */}
            <div className="relative mx-auto w-56 h-56 mb-2">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/25 via-primary/10 to-transparent blur-2xl" />
              <div className="absolute inset-6 rounded-full bg-gradient-to-tr from-primary/15 to-secondary/15 blur-xl animate-pulse" />
              <motion.img
                src={mascotWelcome}
                alt="Pingo, mascote da AloClínica"
                className="relative w-full h-full object-contain drop-shadow-2xl"
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: [0, -6, 0], opacity: 1 }}
                transition={{ y: { duration: 3, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.5 } }}
                loading="eager"
                decoding="async"
                width={224}
                height={224}
              />
              {/* Floating accents */}
              <motion.div
                className="absolute top-4 -left-1 w-7 h-7 rounded-full bg-secondary/30 backdrop-blur-sm border border-secondary/40 flex items-center justify-center shadow-lg"
                animate={{ y: [0, -10, 0], rotate: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Heart className="w-3.5 h-3.5 text-secondary" />
              </motion.div>
              <motion.div
                className="absolute top-10 -right-2 w-7 h-7 rounded-full bg-primary/15 backdrop-blur-sm border border-primary/30 flex items-center justify-center shadow-lg"
                animate={{ y: [0, -8, 0], rotate: [0, -10, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </motion.div>
              <motion.div
                className="absolute bottom-6 -right-1 w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center shadow-lg"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <Stethoscope className="w-3.5 h-3.5 text-primary" />
              </motion.div>
            </div>

            {/* Speech bubble with name */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="relative bg-card rounded-2xl border border-border/60 px-4 py-2.5 max-w-[260px] mx-auto mb-5 shadow-md"
            >
              <p className="text-[12px] text-foreground leading-snug font-medium">
                Olá{firstName ? <>, <span className="text-primary font-bold">{firstName.split(" ")[0]}</span></> : ""}! Eu sou o <span className="text-primary font-bold">Pingo</span> 🐧
              </p>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-l border-t border-border/60 rotate-45" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-[28px] sm:text-3xl font-black text-foreground leading-[1.1] tracking-tight mb-3"
            >
              Sua saúde em<br />
              <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent italic">
                boas mãos.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-[13px] text-muted-foreground leading-relaxed max-w-[300px] mx-auto mb-4"
            >
              Vamos configurar seu perfil em <span className="font-semibold text-foreground">2 minutos</span> para você começar a cuidar da saúde.
            </motion.p>

            {/* Steps preview */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
              className="flex items-center justify-center gap-2 mb-4 text-[10px] text-muted-foreground"
            >
              <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px]">1</span> Você</span>
              <ArrowRight className="w-3 h-3 opacity-40" />
              <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px]">2</span> Identidade</span>
              <ArrowRight className="w-3 h-3 opacity-40" />
              <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px]">3</span> Pronto!</span>
            </motion.div>

            {/* Trust chips */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex flex-wrap justify-center gap-1.5"
            >
              {[
                { icon: <ShieldCheck className="w-3 h-3" />, label: "100% seguro" },
                { icon: <Stethoscope className="w-3 h-3" />, label: "Médicos verificados" },
                { icon: <Heart className="w-3 h-3" />, label: "Cuidado humano" },
              ].map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted/60 border border-border/40 px-2.5 py-1 rounded-full">
                  {c.icon} {c.label}
                </span>
              ))}
            </motion.div>
          </div>
        );

      case "personal": {
        const rawCpf = cpf.replace(/\D/g, "");
        const cpfValid = rawCpf.length === 11 && validarCPF(rawCpf);
        const cpfPartial = rawCpf.length > 0 && rawCpf.length < 11;
        const rawPhone = phone.replace(/\D/g, "");
        const phoneValid = rawPhone.length >= 10;
        const phonePartial = rawPhone.length > 0 && rawPhone.length < 10;
        const todayMax = new Date().toISOString().split("T")[0];

        const toggleAllergy = (item: string) => {
          if (item === "Nenhuma") { setAllergies(["Nenhuma"]); return; }
          setAllergies((prev) => {
            const cleaned = prev.filter((x) => x !== "Nenhuma");
            return cleaned.includes(item) ? cleaned.filter((x) => x !== item) : [...cleaned, item];
          });
        };
        const toggleCondition = (item: string) => {
          if (item === "Nenhuma") { setChronicConditions(["Nenhuma"]); return; }
          setChronicConditions((prev) => {
            const cleaned = prev.filter((x) => x !== "Nenhuma");
            return cleaned.includes(item) ? cleaned.filter((x) => x !== item) : [...cleaned, item];
          });
        };

        return (
          <div className="text-left space-y-4">
            <div className="text-center mb-1">
              <h2 className="text-xl font-bold text-foreground">
                {identityPrefilled && !editingIdentity ? "Confirme seus dados" : "Sobre você"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {identityPrefilled && !editingIdentity
                  ? "Já trouxemos os dados do seu cadastro 💚"
                  : "Leva 1 minuto. Tudo é confidencial 🔒"}
              </p>
            </div>

            {/* Identidade */}
            {identityPrefilled && !editingIdentity ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl bg-gradient-to-br from-primary/5 to-card border border-primary/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Dados confirmados
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingIdentity(true)}
                    className="text-[11px] text-primary font-semibold hover:underline"
                  >
                    Editar
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-primary" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nome</p>
                      <p className="font-semibold text-foreground truncate">{firstName} {lastName}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-card border border-border/40 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">CPF</p>
                      <p className="font-mono text-sm font-semibold text-foreground">{cpfMasked}</p>
                    </div>
                    <div className="rounded-xl bg-card border border-border/40 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Telefone</p>
                      <p className="font-mono text-sm font-semibold text-foreground">{phoneMasked}</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-card border border-border/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nascimento</p>
                    <p className="text-sm font-semibold text-foreground">
                      {dateOfBirth ? new Date(dateOfBirth + "T00:00:00").toLocaleDateString("pt-BR") : ""}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Identidade
                  </p>
                  {identityPrefilled && (
                    <button
                      type="button"
                      onClick={() => setEditingIdentity(false)}
                      className="text-[11px] text-muted-foreground font-semibold hover:underline"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nome *</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Seu nome" className="mt-1 h-11 rounded-xl" autoComplete="given-name" />
                  </div>
                  <div>
                    <Label className="text-xs">Sobrenome *</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Sobrenome" className="mt-1 h-11 rounded-xl" autoComplete="family-name" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs flex items-center justify-between">
                    <span>CPF *</span>
                    {cpfValid && <span className="text-[10px] text-primary inline-flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> válido</span>}
                    {rawCpf.length === 11 && !cpfValid && <span className="text-[10px] text-destructive">inválido</span>}
                  </Label>
                  <CpfInput
                    value={cpf}
                    onChange={setCpf}
                    className="mt-1"
                    inputClassName={`h-11 rounded-xl ${cpfValid ? "border-primary/40 focus-visible:ring-primary/30" : rawCpf.length === 11 ? "border-destructive/50" : ""}`}
                  />
                  {cpfPartial && <p className="text-[10px] text-muted-foreground mt-1">Continue digitando…</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs flex items-center justify-between">
                      <span>Telefone *</span>
                      {phoneValid && <CheckCircle2 className="w-3 h-3 text-primary" />}
                    </Label>
                    <Input
                      value={phoneMasked}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder="(00) 00000-0000"
                      className={`mt-1 h-11 rounded-xl font-mono ${phoneValid ? "border-primary/40" : phonePartial ? "border-amber-400/50" : ""}`}
                      maxLength={15}
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nascimento *</Label>
                    <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="mt-1 h-11 rounded-xl" max={todayMax} />
                  </div>
                </div>
              </div>
            )}

            {/* Saúde — agora opcional */}
            <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                  <Heart className="w-3 h-3" /> Sua saúde
                </p>
                <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">Opcional</span>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">Ajuda os médicos a te atender melhor. É totalmente opcional — você pode pular agora e preencher depois no seu painel.</p>

              <div>
                <Label className="text-xs flex items-center gap-1"><Droplets className="w-3 h-3" /> Tipo Sanguíneo</Label>
                <Select value={bloodType} onValueChange={setBloodType}>
                  <SelectTrigger className={`mt-1 h-11 rounded-xl ${bloodType ? "border-primary/40" : ""}`}>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>{BLOOD_TYPES.map((bt) => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Alergias</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">Toque para selecionar as comuns</p>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_ALLERGIES.map((a) => {
                    const active = allergies.includes(a);
                    return (
                      <button
                        type="button"
                        key={a}
                        onClick={() => toggleAllergy(a)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${active ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-muted/40 text-foreground border-border/40 hover:border-primary/40"}`}
                      >
                        {active && <CheckCircle2 className="w-3 h-3 inline mr-1" />}{a}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => toggleAllergy("Nenhuma")}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${allergies.includes("Nenhuma") ? "bg-secondary text-secondary-foreground border-secondary" : "bg-muted/40 border-dashed border-border/60 text-muted-foreground hover:border-secondary/50"}`}
                  >
                    Não tenho
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={allergyInput}
                    onChange={(e) => setAllergyInput(e.target.value)}
                    placeholder="Outra alergia"
                    className="h-10 rounded-xl flex-1 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAllergy())}
                  />
                  <Button size="sm" variant="outline" onClick={addAllergy} aria-label="Adicionar alergia" className="h-10 w-10 rounded-xl shrink-0"><Plus className="w-4 h-4" /></Button>
                </div>
                {allergies.filter((a) => !COMMON_ALLERGIES.includes(a) && a !== "Nenhuma").length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {allergies.filter((a) => !COMMON_ALLERGIES.includes(a) && a !== "Nenhuma").map((a) => (
                      <Badge key={a} variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setAllergies((prev) => prev.filter((x) => x !== a))}>
                        {a} <X className="w-2.5 h-2.5" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1"><Heart className="w-3 h-3" /> Condições crônicas</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">Toque para selecionar as comuns</p>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_CONDITIONS.map((c) => {
                    const active = chronicConditions.includes(c);
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => toggleCondition(c)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${active ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-muted/40 text-foreground border-border/40 hover:border-primary/40"}`}
                      >
                        {active && <CheckCircle2 className="w-3 h-3 inline mr-1" />}{c}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => toggleCondition("Nenhuma")}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${chronicConditions.includes("Nenhuma") ? "bg-secondary text-secondary-foreground border-secondary" : "bg-muted/40 border-dashed border-border/60 text-muted-foreground hover:border-secondary/50"}`}
                  >
                    Não tenho
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={conditionInput}
                    onChange={(e) => setConditionInput(e.target.value)}
                    placeholder="Outra condição"
                    className="h-10 rounded-xl flex-1 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCondition())}
                  />
                  <Button size="sm" variant="outline" onClick={addCondition} aria-label="Adicionar condição" className="h-10 w-10 rounded-xl shrink-0"><Plus className="w-4 h-4" /></Button>
                </div>
                {chronicConditions.filter((c) => !COMMON_CONDITIONS.includes(c) && c !== "Nenhuma").length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {chronicConditions.filter((c) => !COMMON_CONDITIONS.includes(c) && c !== "Nenhuma").map((c) => (
                      <Badge key={c} variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setChronicConditions((prev) => prev.filter((x) => x !== c))}>
                        {c} <X className="w-2.5 h-2.5" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Saúde é opcional: avança sem preencher nada (mesma ação do "Próximo") */}
              <button
                type="button"
                onClick={handleNext}
                disabled={saving}
                className="w-full mt-1 flex items-center justify-center gap-1.5 text-[13px] font-bold text-primary hover:underline disabled:opacity-50"
              >
                Pular por agora <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <p className="text-[10px] text-center text-muted-foreground/70 -mt-1">
                Você pode preencher isto quando quiser, no seu painel.
              </p>
            </div>
          </div>
        );
      }

      case "kyc": {
        if (kycCompleted) {
          return (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Identidade Verificada! ✅</h2>
              <p className="text-xs text-muted-foreground">Sua verificação foi aprovada. Prossiga para o próximo passo.</p>
            </div>
          );
        }

        if (kycFailed) {
          return (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Verificação não aprovada</h2>
              <p className="text-xs text-muted-foreground">A similaridade facial ficou abaixo do mínimo. Tente novamente com fotos mais nítidas.</p>
              <Button onClick={() => { setKycFailed(false); setKycReady(false); }} variant="outline" className="rounded-xl gap-2 mt-2">
                <Camera className="w-4 h-4" /> Tentar Novamente
              </Button>
            </div>
          );
        }

        if (!kycReady) {
          return (
            <div className="space-y-4">
              <div className="text-center">
                <div className="relative mx-auto w-20 h-20 mb-3">
                  <div className="absolute inset-0 rounded-full bg-primary/15 blur-xl" />
                  <div className="relative w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <ShieldCheck className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-foreground">Verificação rápida</h2>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto">
                  Para sua segurança, vamos confirmar sua identidade com uma selfie. Leva ~30s.
                </p>
              </div>

              <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Antes de começar</p>
                {[
                  { icon: <Sparkles className="w-4 h-4 text-primary" />, title: "Boa iluminação", desc: "Fique de frente para a luz, evite sombras." },
                  { icon: <Camera className="w-4 h-4 text-primary" />, title: "Rosto descoberto", desc: "Sem óculos escuros, máscara ou boné." },
                  { icon: <Smartphone className="w-4 h-4 text-primary" />, title: "Câmera firme", desc: "Centralize o rosto na guia da tela." },
                ].map((tip) => (
                  <div key={tip.title} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">{tip.icon}</div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{tip.title}</p>
                      <p className="text-xs text-muted-foreground">{tip.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-foreground/80 leading-relaxed">
                  Suas fotos são processadas com criptografia e usadas <strong>apenas para verificação</strong>. Nunca compartilhamos com terceiros.
                </p>
              </div>

              <div className="space-y-3">
                <Button onClick={() => setKycReady(true)} className="w-full h-12 rounded-xl gap-2 text-sm font-bold">
                  <Camera className="w-4 h-4" /> Iniciar verificação
                </Button>

                {IS_DEV && (
                  <Button 
                    variant="outline"
                    onClick={async () => {
                      if (!user) return;
                      try {
                        await db.from("kyc_verificacoes" as any).insert({
                          user_id: user.id,
                          status: "approved",
                          similarity: 1.0,
                          tipo: "paciente",
                        });
                        setKycCompleted(true);
                        localStorage.removeItem(KYC_PENDING_KEY);
                        toast.success("KYC pulado (Dev)", { description: "Você pode prosseguir agora." });
                      } catch (err) {
                        // Mesmo se a inserção falhar (RLS, etc.), libera o avanço em modo dev
                        setKycCompleted(true);
                        localStorage.removeItem(KYC_PENDING_KEY);
                        toast.success("KYC pulado (Dev — local)", { description: "Avanço liberado para teste." });
                      }
                    }}
                    className="w-full h-10 rounded-xl border-dashed border-primary/40 text-primary/70 hover:text-primary hover:border-primary text-xs font-bold gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" /> Pular Verificação (Dev)
                  </Button>
                )}
              </div>
            </div>
          );
        }

        return (
          <KycCrossDevice
            tipo="paciente"
            onComplete={(result) => {
              if (result.status === "aprovado") {
                setKycCompleted(true);
                localStorage.removeItem(KYC_PENDING_KEY);
              } else {
                setKycFailed(true);
              }
            }}
            variant="full"
          />
        );
      }

      case "tour":
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground text-center">O que você pode fazer</h2>
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-4 p-4 rounded-2xl bg-card border border-border/50">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0">{f.icon}</div>
                <div>
                  <p className="text-sm font-bold text-foreground">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
            {/* Highlight banner */}
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/70">DESTAQUE DO MÊS</p>
              <p className="text-base font-bold mt-1">Check-up Preventivo</p>
              <p className="text-xs text-primary-foreground/70 mt-0.5">Incluso no seu plano AloClínica.</p>
            </div>
          </div>
        );

      case "done":
        return (
          <div className="text-center pt-4">
            <div className="relative mx-auto w-40 h-40 mb-4">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-secondary/20 blur-2xl" />
              <motion.img
                src={mascotWelcome}
                alt="Pingo comemorando"
                className="relative w-full h-full object-contain drop-shadow-2xl"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, rotate: [0, -4, 4, 0] }}
                transition={{ scale: { duration: 0.4 }, rotate: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
              />
              <motion.div
                className="absolute -top-1 right-2 w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
              >
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </motion.div>
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2 tracking-tight">
              Tudo pronto! <span className="text-secondary">💚</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
              Agende sua primeira consulta e comece a cuidar da saúde com a <span className="font-semibold text-foreground">AloClínica</span>.
            </p>
          </div>
        );
      default: return null;
    }
  };

   return (
     <div className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden">
       <div className="absolute top-4 right-4 z-[110]">
         <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" onClick={markAsCompleted} aria-label="Fechar onboarding">
           <X className="w-5 h-5 text-muted-foreground" />
         </Button>
       </div>
       {/* Decorative gradient backdrop */}
       <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-secondary/5" />
      <div className="pointer-events-none absolute -top-32 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 w-72 h-72 rounded-full bg-secondary/10 blur-3xl" />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h2 className="text-lg font-extrabold text-primary italic">AloClínica</h2>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/80 font-semibold bg-muted/50 px-2.5 py-1 rounded-full">
          <ShieldCheck className="w-3 h-3" /> Cadastro seguro
        </span>
      </div>

      {/* Step indicators */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.id}
              className="h-1.5 flex-1 rounded-full overflow-hidden"
              style={{ backgroundColor: i <= currentStep ? "hsl(var(--primary))" : "hsl(var(--muted))" }}
              initial={false}
              animate={{
                backgroundColor: i <= currentStep ? "hsl(var(--primary))" : "hsl(var(--muted))",
                scale: i === currentStep ? 1 : 0.95,
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-muted-foreground">{step.title}</p>
          <p className="text-[10px] text-muted-foreground/60">{currentStep + 1}/{STEPS.length}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-32">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-background border-t border-border/50 safe-bottom">
        <div className="flex gap-2 max-w-md mx-auto">
          {currentStep > 0 && (
            <Button variant="outline" className="h-12 rounded-xl px-4" onClick={() => setCurrentStep(prev => prev - 1)} aria-label="Voltar">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <Button
            className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-base shadow-lg shadow-primary/20 disabled:opacity-40"
            onClick={handleNext}
            disabled={saving || (step.id === "kyc" && !kycCompleted)}
          >
            {saving ? "Salvando..." : isLast ? "Começar Agora" : (
              <>Próximo <ArrowRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        </div>
        {step.id === "kyc" && !kycCompleted && (
          <p className="w-full text-center text-xs text-destructive/70 mt-3 font-medium">
            ⚠️ Verificação obrigatória para usar a plataforma
          </p>
        )}
        {isLast && (
          <p className="text-center text-xs text-muted-foreground mt-3">
            Tudo pronto para começar! 💚
          </p>
        )}
      </div>
      </div>
    </div>
  );
};

export { ONBOARDING_KEY, KYC_PENDING_KEY };
export default PatientOnboarding;
