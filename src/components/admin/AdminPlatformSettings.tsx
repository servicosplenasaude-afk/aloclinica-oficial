/**
 * AdminPlatformSettings — central de configurações da plataforma.
 *
 * Tabs:
 *  - Manutenção: enable/disable + mensagem + ETA
 *  - SEO: título/descrição padrão
 *  - robots.txt: editor texto puro
 *
 * Tudo persiste em app_settings (key/value JSONB).
 */
import { useEffect, useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getAdminNav } from "./adminNav";
import { AdminPageHeader } from "./AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Settings, Save, RefreshCw, AlertTriangle, Globe, FileText, Megaphone,
} from "lucide-react";
import { warn } from "@/lib/logger";

const adminNav = getAdminNav("platform-settings");

type Maint = { enabled: boolean; message: string; expected_back_at: string | null; allow_admin: boolean };
type Announcement = { active: boolean; message: string };
type Seo = { site_name: string; default_title: string; default_description: string; twitter_handle: string };
type Robots = { content: string };

const defaultMaint: Maint = { enabled: false, message: "", expected_back_at: null, allow_admin: true };
const defaultAnnouncement: Announcement = { active: false, message: "" };
const defaultSeo: Seo = { site_name: "AloClínica", default_title: "", default_description: "", twitter_handle: "" };
const defaultRobots: Robots = { content: "User-agent: *\nAllow: /\nSitemap: https://aloclinica.com.br/sitemap.xml\n" };

const AdminPlatformSettings = () => {
  const [maint, setMaint] = useState<Maint>(defaultMaint);
  const [savedMaint, setSavedMaint] = useState<Maint>(defaultMaint);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);
  const [checkingMaintenanceImpact, setCheckingMaintenanceImpact] = useState(false);
  const [activeConsultations, setActiveConsultations] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement>(defaultAnnouncement);
  const [seo, setSeo] = useState<Seo>(defaultSeo);
  const [robots, setRobots] = useState<Robots>(defaultRobots);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("app_settings")
      .select("key, value")
      .in("key", ["maintenance_mode", "global_announcement", "seo", "robots_txt"]);
    if (error) {
      toast.error("Erro carregando configurações", { description: error.message });
      setLoading(false);
      return;
    }
    const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
    const loadedMaint = { ...defaultMaint, ...(map.maintenance_mode ?? {}) };
    setMaint(loadedMaint);
    setSavedMaint(loadedMaint);
    setAnnouncement({ ...defaultAnnouncement, ...(map.global_announcement ?? {}) });
    setSeo({ ...defaultSeo, ...(map.seo ?? {}) });
    setRobots({ ...defaultRobots, ...(map.robots_txt ?? {}) });
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const saveKey = async (key: string, value: any) => {
    setSaving(key);
    const { error } = await db
      .from("app_settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      setSaving(null);
      return false;
    } else {
      toast.success("Configuração salva");
    }
    setSaving(null);
    return true;
  };

  const maintenanceDirty = JSON.stringify(maint) !== JSON.stringify(savedMaint);
  const invalidExpectedBack = Boolean(maint.expected_back_at && Date.parse(maint.expected_back_at) <= Date.now());

  useEffect(() => {
    if (!maintenanceDirty) return undefined;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [maintenanceDirty]);

  const persistMaintenance = async () => {
    if (invalidExpectedBack) {
      toast.error("A previsão precisa estar no futuro");
      return false;
    }
    const saved = await saveKey("maintenance_mode", maint);
    if (saved) setSavedMaint(maint);
    return saved;
  };

  const requestMaintenanceSave = async () => {
    if (maint.enabled && !savedMaint.enabled) {
      setCheckingMaintenanceImpact(true);
      const { count, error } = await db
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress");
      setCheckingMaintenanceImpact(false);
      if (error) {
        toast.error("Não foi possível verificar consultas em andamento", { description: "A ativação foi bloqueada por segurança. Tente novamente." });
        return;
      }
      setActiveConsultations(count ?? 0);
      setConfirmMaintenance(true);
      return;
    }
    void persistMaintenance();
  };

  return (
    <DashboardLayout title="Admin" nav={adminNav}>
      <div className="space-y-5 pb-24 md:pb-8">
        <AdminPageHeader
          icon={Settings}
          eyebrow="Plataforma"
          title="Configurações da plataforma"
          description="Modo manutenção, SEO global, robots.txt."
          accent="from-slate-500 to-slate-700"
          actions={
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="gap-1.5">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          }
        />

        <Tabs defaultValue="maintenance">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-grid sm:w-auto sm:grid-cols-4">
            <TabsTrigger value="maintenance" className="gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Manutenção
              {maint.enabled && <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">ON</span>}
            </TabsTrigger>
            <TabsTrigger value="announcement" className="gap-1.5">
              <Megaphone className="w-3.5 h-3.5" /> Anúncio
              {announcement.active && <span className="text-[10px] font-bold bg-sky-500 text-white px-1.5 py-0.5 rounded-full">ON</span>}
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5">
              <Globe className="w-3.5 h-3.5" /> SEO
            </TabsTrigger>
            <TabsTrigger value="robots" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> robots.txt
            </TabsTrigger>
          </TabsList>

          <TabsContent value="maintenance" className="mt-4">
            <Card className={maint.enabled ? "border-amber-400/60 shadow-sm" : undefined}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">Modo manutenção</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {maintenanceDirty && <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300">ALTERAÇÕES NÃO SALVAS</span>}
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${maint.enabled ? "bg-amber-500 text-amber-950" : "bg-muted text-muted-foreground"}`}>
                      {maint.enabled ? (savedMaint.enabled ? "MANUTENÇÃO ATIVA" : "ATIVO APÓS SALVAR") : "SITE DISPONÍVEL"}
                    </span>
                  </div>
                </div>
                <CardDescription>
                  Quando ativado, pacientes e médicos deixam de acessar a plataforma e veem uma tela de manutenção.
                  Admins continuam navegando somente se a permissão abaixo estiver ligada.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                <div className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${maint.enabled ? "border-amber-400/60 bg-amber-500/10" : "bg-muted/20"}`}>
                  <div>
                    <Label className="text-base">Ativar modo manutenção</Label>
                    <p id="maintenance-impact" className="mt-1 text-xs leading-relaxed text-muted-foreground">Bloqueia o acesso de pacientes e médicos depois que você salvar.</p>
                  </div>
                  <Switch
                    checked={maint.enabled}
                    onCheckedChange={(v) => setMaint({ ...maint, enabled: v })}
                    aria-describedby="maintenance-impact"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Mensagem (opcional)</Label>
                  <Textarea
                    value={maint.message}
                    onChange={(e) => setMaint({ ...maint, message: e.target.value })}
                    placeholder="Ex: Estamos atualizando o sistema. Voltamos em breve!"
                    rows={3}
                    maxLength={280}
                  />
                  <p className="text-right text-[11px] tabular-nums text-muted-foreground">{maint.message.length}/280</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Previsão de retorno (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={maint.expected_back_at?.slice(0, 16) ?? ""}
                    onChange={(e) => setMaint({ ...maint, expected_back_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    aria-invalid={invalidExpectedBack}
                    className={invalidExpectedBack ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                  {invalidExpectedBack && <p role="alert" className="text-xs text-destructive">Escolha uma data e hora futuras.</p>}
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                  <div>
                    <Label className="text-sm">Permitir acesso administrativo</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Recomendado para acompanhar o incidente e desativar a manutenção.</p>
                  </div>
                  <Switch
                    checked={maint.allow_admin}
                    onCheckedChange={(v) => setMaint({ ...maint, allow_admin: v })}
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">A alteração pode levar até 60 segundos para aparecer.</p>
                  <Button onClick={() => void requestMaintenanceSave()} disabled={saving === "maintenance_mode" || checkingMaintenanceImpact || loading || !maintenanceDirty || invalidExpectedBack} className="min-h-11 gap-2">
                    {saving === "maintenance_mode" || checkingMaintenanceImpact ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {checkingMaintenanceImpact ? "Verificando impacto..." : maint.enabled ? "Salvar e ativar" : "Salvar configuração"}
                  </Button>
                </div>
                </div>

                <aside className="rounded-2xl border bg-muted/20 p-4 lg:sticky lg:top-4 lg:self-start" aria-label="Prévia da tela de manutenção">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Prévia para usuários</p>
                  <div className="mt-4 rounded-2xl border bg-background p-5 text-center shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <Settings className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-sm font-bold text-foreground">Estamos em manutenção</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {maint.message.trim() || "Estamos fazendo uma manutenção para melhorar sua experiência. Voltamos em instantes."}
                    </p>
                    {maint.expected_back_at && (
                      <p className="mt-3 rounded-full bg-muted px-3 py-1.5 text-[11px] font-medium text-foreground">
                        Retorno previsto: {new Date(maint.expected_back_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    )}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Use uma mensagem curta, diga o impacto e informe uma previsão realista.</p>
                </aside>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="announcement" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Anúncio global</CardTitle>
                <CardDescription>
                  Quando ativado, todos os usuários veem um banner azul dispensável no topo do site.
                  Ideal para avisos gerais (novidades, campanhas, mudanças). Diferente do modo
                  manutenção, não sugere indisponibilidade do sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-base">Ativar anúncio</Label>
                    <p className="text-xs text-muted-foreground">Mostra banner global pra todos.</p>
                  </div>
                  <Switch
                    checked={announcement.active}
                    onCheckedChange={(v) => setAnnouncement({ ...announcement, active: v })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={announcement.message}
                    onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })}
                    placeholder="Ex: Novidade! Agora você pode agendar consultas de retorno com 1 clique."
                    rows={3}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    O banner só aparece se estiver ativado e com mensagem preenchida.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => saveKey("global_announcement", announcement)} disabled={saving === "global_announcement"} className="gap-2">
                    {saving === "global_announcement" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar anúncio
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seo" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SEO global</CardTitle>
                <CardDescription>
                  Defaults para páginas que não definem SEO próprio. Alterações refletem no &lt;title&gt; e meta tags.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome do site</Label>
                  <Input value={seo.site_name} onChange={(e) => setSeo({ ...seo, site_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Título padrão (até 60 caracteres ideal)</Label>
                  <Input value={seo.default_title} onChange={(e) => setSeo({ ...seo, default_title: e.target.value })} maxLength={120} />
                  <p className="text-[11px] text-muted-foreground">{seo.default_title.length}/60</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição padrão (até 160 caracteres ideal)</Label>
                  <Textarea value={seo.default_description} onChange={(e) => setSeo({ ...seo, default_description: e.target.value })} rows={3} maxLength={300} />
                  <p className="text-[11px] text-muted-foreground">{seo.default_description.length}/160</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Twitter handle (com @)</Label>
                  <Input value={seo.twitter_handle} onChange={(e) => setSeo({ ...seo, twitter_handle: e.target.value })} placeholder="@aloclinica" />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => saveKey("seo", seo)} disabled={saving === "seo"} className="gap-2">
                    {saving === "seo" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar SEO
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="robots" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">robots.txt</CardTitle>
                <CardDescription>
                  Servido em <code className="text-xs">/robots.txt</code>. Edite com cuidado — afeta indexação no Google.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={robots.content}
                  onChange={(e) => setRobots({ content: e.target.value })}
                  rows={12}
                  className="font-mono text-xs"
                />
                <div className="flex justify-end">
                  <Button onClick={() => saveKey("robots_txt", robots)} disabled={saving === "robots_txt"} className="gap-2">
                    {saving === "robots_txt" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar robots.txt
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={confirmMaintenance} onOpenChange={(open) => saving !== "maintenance_mode" && setConfirmMaintenance(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar modo manutenção?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">Pacientes e médicos perderão o acesso à plataforma em até 60 segundos.</span>
              {activeConsultations === 0 ? (
                <span className="block font-medium text-success">Verificação concluída: nenhuma consulta está em andamento.</span>
              ) : (
                <span className="block font-semibold text-destructive">Atenção: {activeConsultations} consulta(s) estão em andamento e podem ser interrompidas.</span>
              )}
              <span className="block">Confirme que a equipe foi avisada e que existe um plano de retorno.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving === "maintenance_mode"}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving === "maintenance_mode"}
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={(event) => {
                event.preventDefault();
                void persistMaintenance().then((saved) => saved && setConfirmMaintenance(false));
              }}
            >
              {saving === "maintenance_mode" ? "Ativando..." : activeConsultations ? "Ativar mesmo assim" : "Confirmar e ativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminPlatformSettings;
