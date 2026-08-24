import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/untyped";
import { logError } from "@/lib/logger";
import DashboardLayout from "./DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, UserCog, TrendingUp, Pill, FlaskConical, CheckCircle, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { HeroBanner } from "./HeroBanner";
import { StatBento } from "./StatBento";
import { ActionPills } from "./ActionPills";
import { PingoBannerCard } from "@/components/mascot/PingoBannerCard";
import { PremiumHero } from "./PremiumHero";
import { PrescriptionFinder } from "./PrescriptionFinder";
import { AlertBox } from "./AlertBox";
import RoleOnboarding from "@/components/onboarding/RoleOnboarding";
import pingoPartner from "@/assets/states/pingo-dashboard-parceiro.webp";

const getPartnerNav = (active: string) => [
  { label: "Visão Geral", href: "/dashboard?role=partner", icon: <TrendingUp className="w-4 h-4" />, active: active === "overview", group: "Principal" },
  { label: "Validar Receitas", href: "/dashboard/partner/validate?role=partner", icon: <Pill className="w-4 h-4" />, active: active === "validate", group: "Principal" },
  { label: "Histórico", href: "/dashboard/partner/history?role=partner", icon: <FileText className="w-4 h-4" />, active: active === "history", group: "Operações" },
  { label: "Conversão", href: "/dashboard/partner/conversion?role=partner", icon: <FlaskConical className="w-4 h-4" />, active: active === "conversion", group: "Operações" },
  { label: "Perfil", href: "/dashboard/profile?role=partner", icon: <UserCog className="w-4 h-4" />, active: active === "profile", group: "Conta" },
];

const PartnerDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [validations, setValidations] = useState<Array<{ id: string; prescription_id: string; status: string; notes: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState("Parceiro");
  const activeNav = location.pathname.includes("validate") ? "validate" : location.pathname.includes("history") ? "history" : location.pathname.includes("conversion") ? "conversion" : "overview";

  useEffect(() => {
    fetchValidations();
    if (user?.id) {
      loadPartnerName();
    }
    if (activeNav === "history") localStorage.setItem("partner_visited_history", "true");
  }, [user?.id, activeNav]);

  const loadPartnerName = async () => {
    try {
      const { data, error } = await db
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user!.id)
        .single();

      if (error) {
        logError("Error loading partner name:", error);
        return;
      }

      if (data) {
        const name = `${data.first_name || ""} ${data.last_name || ""}`.trim();
        setPartnerName(name || "Parceiro");
      }
    } catch (error) {
      logError("Error loading partner name:", error);
    }
  };

  const fetchValidations = async () => {
    if (!user) return;
    const { data } = await db.from("prescription_validations").select("id, prescription_id, status, notes, created_at").eq("validated_by", user.id).order("created_at", { ascending: false }).limit(50);
    setValidations(data ?? []);
    setLoading(false);
  };

  const dispensedCount = validations.filter(v => v.status === "dispensed").length;
  const conversionRate = validations.length > 0 ? Math.round((dispensedCount / validations.length) * 100) : 0;

  return (
    <DashboardLayout title="Portal do Parceiro" nav={getPartnerNav(activeNav)}>
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-24">

        <RoleOnboarding role="partner" />

                <div className="-mx-4 -mt-5 md:-mx-6 md:-mt-5 lg:-mx-8 lg:-mt-6">
        <HeroBanner
          gradient="from-[#022B1C] via-[#065f46] to-[#059669]"
          pingoSrc={pingoPartner}
          pingoAlt="Pingo"
          liveDot={true}
          liveColor="green"
          bubble={{
            greeting: "🤝 Portal de parceiros",
            name: partnerName,
            sub: "Validação de receitas",
          }}
          kpis={[
            { label: "Validações", value: validations.length },
            { label: "Dispensados", value: dispensedCount },
            { label: "Conversão", value: `${conversionRate}%` },
          ]}
          loading={loading}
          onRefresh={undefined}
          refreshing={false}
        />
      </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-start">
        <div className="space-y-5">
        <StatBento loading={loading} stats={[
          { label: "Total de validações", value: validations.length, icon: "💊", iconBg: "bg-emerald-50 dark:bg-emerald-950/30", valueClass: "text-emerald-700 dark:text-emerald-400", trend: 8, accentClass: "bg-emerald-500" },
          { label: "Dispensados", value: dispensedCount, icon: "✅", iconBg: "bg-blue-50 dark:bg-blue-950/30", valueClass: "text-[#1255C8] dark:text-blue-400", accentClass: "bg-blue-500" },
          { label: "Taxa de conversão", value: `${conversionRate}%`, icon: "📈", iconBg: "bg-amber-50 dark:bg-amber-950/30", valueClass: "text-amber-600 dark:text-amber-400", accentClass: "bg-amber-500" },
          { label: "Hoje", value: validations.filter(v => new Date(v.created_at).toDateString() === new Date().toDateString()).length, icon: "📅", iconBg: "bg-violet-50 dark:bg-violet-950/30", valueClass: "text-violet-600 dark:text-violet-400", accentClass: "bg-violet-500" },
        ]} />

        {/* Pingo Banner */}
        <PingoBannerCard
          pingImg={pingoPartner}
          pingAlt="Pingo"
          pingSize={82}
          bgClass="bg-teal-50 dark:bg-teal-950/20"
          borderClass="border-teal-100 dark:border-teal-900/30"
          label="Portal parceiro"
          labelColor="text-teal-600 dark:text-teal-400"
          title="Receitas 100% autênticas"
          subtitle="Busque e dispense com segurança"
        />
        </div>{/* end LEFT col */}

        <div className="space-y-5">
        <Tabs defaultValue="validate">
          <TabsList className="h-11 rounded-xl border border-border/30 bg-muted/40 p-1">
            <TabsTrigger value="validate" className="rounded-lg text-[11.5px] gap-1.5 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"><Pill className="w-3.5 h-3.5" /> Validar</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg text-[11.5px] gap-1.5 font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"><FileText className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="validate" className="mt-5">
            
<PrescriptionFinder onValidated={fetchValidations} />
          </TabsContent>

          <TabsContent value="history" className="mt-5">
            <div className="overflow-hidden rounded-2xl border border-border/25 bg-card" style={{ boxShadow: "0 2px 12px rgba(0,0,0,.04)" }}>
              <div className="border-b border-border/15 px-4 py-3">
                <p className="text-[11.5px] font-bold text-foreground">Histórico de Validações</p>
              </div>
              {loading ? (
                <div className="p-4 space-y-3" aria-busy="true" aria-label="Carregando histórico de validações">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Carregando histórico…</p>
                  {[1,2,3,4].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/50" />)}
                </div>
              ) : validations.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/40 text-[22px]">📋</div>
                  <p className="text-[13px] font-semibold text-foreground">Nenhuma validação ainda</p>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">Busque uma receita para começar</p>
                </div>
              ) : (
                <div className="divide-y divide-border/15">
                  {validations.slice(0, 10).map(v => (
                    <motion.div key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-[14px] ${v.status === "dispensed" ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-amber-50 dark:bg-amber-950/30"}`}>
                        {v.status === "dispensed" ? "✅" : "⚠️"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-foreground truncate">Receita {v.prescription_id?.slice(0, 8)}...</p>
                        <p className="text-[10.5px] text-muted-foreground">{format(new Date(v.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                      </div>
                      <span className={`rounded-lg px-2 py-0.5 text-[9px] font-bold ${v.status === "dispensed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"}`}>
                        {v.status === "dispensed" ? "Dispensado" : "Pendente"}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PartnerDashboard;
