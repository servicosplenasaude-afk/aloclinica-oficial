/**
 * AdminNotificationTemplates — gestão centralizada de templates de notificação
 * (email + WhatsApp + SMS + push) com histórico de envios.
 *
 * 2 tabs:
 *   - Templates: lista de notification_templates por canal, edita slug/subject/body
 *   - Histórico: notification_log com filtros (canal, status, recipient)
 */
import { useEffect, useMemo, useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { getAdminNav } from "./adminNav";
import { AdminPageHeader } from "./AdminPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Bell, Mail, MessageSquare, Save, RefreshCw, Eye, AlertCircle, CheckCircle2, Plus, Lock, Pencil,
} from "lucide-react";

type Tpl = {
  id: string;
  slug: string;
  channel: "email" | "whatsapp" | "sms" | "push";
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  description: string | null;
  variables: string[];
  is_active: boolean;
  is_system: boolean;
  updated_at: string;
};

type LogRow = {
  id: string;
  template_slug: string | null;
  channel: string;
  recipient: string;
  user_id: string | null;
  subject: string | null;
  status: string;
  provider: string | null;
  error: string | null;
  created_at: string;
};

const adminNav = getAdminNav("notification-templates");

const channelIcon: Record<string, any> = {
  email: Mail,
  whatsapp: MessageSquare,
  sms: MessageSquare,
  push: Bell,
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    sent: "border-blue-200 text-blue-700",
    delivered: "border-emerald-200 text-emerald-700",
    opened: "border-emerald-200 text-emerald-700",
    failed: "border-red-200 text-red-700",
    bounced: "border-red-200 text-red-700",
    pending: "border-amber-200 text-amber-700",
  };
  return <Badge variant="outline" className={`text-[10px] ${map[s] ?? ""}`}>{s}</Badge>;
};

const maskRecipient = (recipient: string) => {
  if (recipient.includes("@")) {
    const [local, domain] = recipient.split("@");
    return `${local.slice(0, 2)}•••@${domain}`;
  }
  const digits = recipient.replace(/\D/g, "");
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : "Oculto";
};

const AdminNotificationTemplates = () => {
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [tab, setTab] = useState<"templates" | "log">("templates");
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [edit, setEdit] = useState<Tpl | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [tplRes, logRes] = await Promise.all([
      db.from("notification_templates").select("*").order("slug").order("channel"),
      db.from("notification_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (tplRes.error || logRes.error) {
      toast.error("Não foi possível carregar templates e histórico");
      setLoading(false);
      return;
    }
    setTpls(((tplRes.data ?? []) as any[]).map(t => ({ ...t, variables: t.variables ?? [] })));
    setLogs((logRes.data ?? []) as LogRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredTpls = useMemo(() =>
    filterChannel === "all" ? tpls : tpls.filter(t => t.channel === filterChannel),
    [tpls, filterChannel]
  );

  const filteredLogs = useMemo(() =>
    filterChannel === "all" ? logs : logs.filter(l => l.channel === filterChannel),
    [logs, filterChannel]
  );

  const counts = useMemo(() => ({
    total: tpls.length,
    email: tpls.filter(t => t.channel === "email").length,
    whatsapp: tpls.filter(t => t.channel === "whatsapp").length,
    inactive: tpls.filter(t => !t.is_active).length,
    failed24h: logs.filter(l => l.status === "failed" && Date.now() - new Date(l.created_at).getTime() < 86400000).length,
  }), [tpls, logs]);

  const saveTpl = async () => {
    if (!edit) return;
    setSaving(true);
    const { error } = await db
      .from("notification_templates")
      .update({
        subject: edit.subject,
        body_html: edit.body_html,
        body_text: edit.body_text,
        description: edit.description,
        is_active: edit.is_active,
      })
      .eq("id", edit.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Template salvo");
    setEdit(null);
    await fetchAll();
  };

  const toggleActive = async (t: Tpl) => {
    const { error } = await db
      .from("notification_templates")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) toast.error(error.message);
    else await fetchAll();
  };

  return (
    <DashboardLayout title="Admin" nav={adminNav}>
      <div className="space-y-5 pb-24 md:pb-8">
        <AdminPageHeader
          icon={Bell}
          eyebrow="Notificações"
          title="Templates & Histórico"
          description={`${counts.total} templates · ${counts.email} email · ${counts.whatsapp} WhatsApp · ${counts.inactive} inativos`}
          accent="from-blue-500 to-indigo-600"
          badge={
            counts.failed24h > 0
              ? { label: `${counts.failed24h} falha${counts.failed24h === 1 ? "" : "s"} em 24h`, tone: "danger" }
              : undefined
          }
          actions={
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-1.5">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="templates">Templates ({counts.total})</TabsTrigger>
              <TabsTrigger value="log">Histórico ({logs.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={filterChannel} onValueChange={setFilterChannel}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos canais</SelectItem>
              <SelectItem value="email">📧 Email</SelectItem>
              <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
              <SelectItem value="sms">📱 SMS</SelectItem>
              <SelectItem value="push">🔔 Push</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tab === "templates" && (
          <div className="grid gap-3">
            {loading ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Carregando...</CardContent></Card>
            ) : filteredTpls.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum template no canal selecionado.</CardContent></Card>
            ) : filteredTpls.map(t => {
              const Icon = channelIcon[t.channel];
              return (
                <Card key={t.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-sm font-mono">{t.slug}</code>
                            <Badge variant="outline" className="text-[10px]">{t.channel}</Badge>
                            {t.is_system && (
                              <Badge variant="outline" className="text-[10px] gap-1 text-slate-600">
                                <Lock className="w-2.5 h-2.5" /> sistema
                              </Badge>
                            )}
                            {!t.is_active && <Badge variant="destructive" className="text-[10px]">desativado</Badge>}
                          </div>
                          {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                          {t.subject && <p className="text-xs mt-1"><strong>Assunto:</strong> {t.subject}</p>}
                          {t.variables.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {t.variables.map(v => (
                                <code key={v} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{`{{${v}}}`}</code>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                        <Button size="sm" variant="outline" onClick={() => setEdit(t)} className="gap-1">
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "log" && (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Quando</TableHead>
                    <TableHead scope="col">Canal</TableHead>
                    <TableHead scope="col">Template</TableHead>
                    <TableHead scope="col">Para</TableHead>
                    <TableHead scope="col">Provider</TableHead>
                    <TableHead scope="col">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem histórico no canal selecionado</TableCell></TableRow>
                  ) : filteredLogs.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(l.created_at), "dd/MM/yy HH:mm")}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{l.channel}</Badge></TableCell>
                      <TableCell className="text-xs"><code>{l.template_slug ?? "—"}</code></TableCell>
                      <TableCell className="text-xs truncate max-w-[180px]" title="Destinatário mascarado">{maskRecipient(l.recipient)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.provider ?? "—"}</TableCell>
                      <TableCell>{statusBadge(l.status)}{l.error && <p className="text-[10px] text-destructive mt-0.5 truncate max-w-[160px]" title={l.error}>{l.error}</p>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Edit dialog */}
        <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar template</DialogTitle>
            </DialogHeader>
            {edit && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Slug (não editável)</Label>
                    <Input value={edit.slug} disabled className="font-mono text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Canal (não editável)</Label>
                    <Input value={edit.channel} disabled className="text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Descrição (interna)</Label>
                  <Input
                    value={edit.description ?? ""}
                    onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  />
                </div>
                {edit.channel === "email" && (
                  <div>
                    <Label className="text-xs">Assunto do email</Label>
                    <Input
                      value={edit.subject ?? ""}
                      onChange={(e) => setEdit({ ...edit, subject: e.target.value })}
                    />
                  </div>
                )}
                {(edit.channel === "email") && (
                  <div>
                    <Label className="text-xs">Body HTML</Label>
                    <Textarea
                      value={edit.body_html ?? ""}
                      onChange={(e) => setEdit({ ...edit, body_html: e.target.value })}
                      rows={10}
                      className="font-mono text-xs"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Body texto puro {edit.channel === "email" ? "(fallback)" : ""}</Label>
                  <Textarea
                    value={edit.body_text ?? ""}
                    onChange={(e) => setEdit({ ...edit, body_text: e.target.value })}
                    rows={5}
                    className="font-mono text-xs"
                  />
                </div>
                {edit.variables.length > 0 && (
                  <div className="rounded-lg bg-muted/40 p-2.5 text-xs">
                    <strong>Variáveis disponíveis:</strong>{" "}
                    {edit.variables.map(v => (
                      <code key={v} className="inline-block bg-background px-1.5 py-0.5 rounded mr-1">{`{{${v}}}`}</code>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <Label className="text-xs">Ativo</Label>
                  <Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
                </div>
                <div className="rounded-lg border border-primary/20 bg-muted/30 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Prévia segura — não envia</p>
                  {edit.subject && <p className="text-sm font-semibold mb-1">{edit.subject}</p>}
                  <p className="text-xs whitespace-pre-wrap">{edit.body_text || "Sem conteúdo em texto puro."}</p>
                  {edit.variables.length > 0 && <p className="text-[10px] text-amber-700 mt-2">As variáveis permanecem como marcadores nesta prévia.</p>}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
              <Button onClick={saveTpl} disabled={saving} className="gap-2">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminNotificationTemplates;
