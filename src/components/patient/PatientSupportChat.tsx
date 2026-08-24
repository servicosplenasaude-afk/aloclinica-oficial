import { useState, useEffect, useRef, useCallback } from "react";
import pingoSupport from "@/assets/states/pingo-suporte-paciente.webp";
import { db } from "@/integrations/supabase/untyped";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Headset, User, Loader2, ArrowLeft, MessageCircle, Plus, Clock, CheckCircle, ChevronRight, Calendar, CreditCard, FileText } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getPatientNav } from "@/components/patient/patientNav";
import { motion } from "framer-motion";

interface Ticket { id: string; subject: string; status: string; created_at: string; updated_at: string; }
interface TicketMessage { id: string; ticket_id: string; sender_id: string; sender_role: string; content: string; created_at: string; }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  bot: { label: "Bot", color: "bg-secondary/10 text-secondary" },
  waiting_human: { label: "Aguardando suporte", color: "bg-warning/10 text-warning" },
  in_service: { label: "Em atendimento", color: "bg-success/10 text-success" },
  closed: { label: "Encerrado", color: "bg-muted text-muted-foreground" },
};

const QUICK_ACTIONS = [
  { label: "PAGAMENTOS", icon: CreditCard },
  { label: "NOVO EXAME", icon: FileText },
  { label: "FALAR COM HUMANO", icon: Headset },
];

const PatientSupportChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("support_tickets").select("*").eq("patient_id", user.id).order("updated_at", { ascending: false });
    setTickets(data ?? []); setLoading(false);
  }, [user]);

  const fetchMessages = useCallback(async (ticketId: string) => {
    const { data } = await db.from("support_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true });
    setMessages(data ?? []);
    if (user) await db.from("support_messages").update({ is_read: true }).eq("ticket_id", ticketId).eq("sender_role", "support").eq("is_read", false);
  }, [user]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { if (selectedTicket) fetchMessages(selectedTicket.id); }, [selectedTicket, fetchMessages]);

  useEffect(() => {
    if (!user) return;
    const channel = db.channel("patient-support-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload) => {
        const msg = payload.new as TicketMessage;
        if (selectedTicket && msg.ticket_id === selectedTicket.id) setMessages(prev => [...prev, msg]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets" }, () => fetchTickets())
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [user, selectedTicket, fetchTickets]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight, behavior: "smooth" }); }, [messages]);

  const createNewTicket = async () => {
    if (!user) return;
    const { data, error } = await db.from("support_tickets").insert({ patient_id: user.id, subject: "Novo atendimento", status: "waiting_human" }).select().single();
    if (error) { toast.error("Erro ao criar ticket"); return; }
    await db.from("support_messages").insert({ ticket_id: data.id, sender_id: user.id, sender_role: "patient", content: "Olá! Preciso de ajuda humana." });
    toast.success("Solicitação enviada!"); setSelectedTicket(data as Ticket); fetchTickets();
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedTicket || !user || sending) return;
    setSending(true);
    const { error } = await db.from("support_messages").insert({ ticket_id: selectedTicket.id, sender_id: user.id, sender_role: "patient", content: input.trim() });
    if (error) toast.error("Erro ao enviar mensagem"); else setInput("");
    setSending(false);
  };

  const nav = getPatientNav("support");

  if (loading) return (
    <DashboardLayout title="Paciente" nav={nav} role="patient">
      <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
    </DashboardLayout>
  );

  // Chat view — Dr. Pinguim style from mockup
  if (selectedTicket) {
    const statusConf = STATUS_LABELS[selectedTicket.status] ?? STATUS_LABELS.bot;
    return (
      <DashboardLayout title="Paciente" nav={nav} role="patient">
        <div className="w-full mx-auto max-w-2xl pb-24 md:pb-6 flex flex-col h-[calc(100vh-120px)]">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-border mb-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSelectedTicket(null)} aria-label="Voltar para a lista">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="relative">
              <img src={pingoSupport} alt="Dr. Pinguim" className="w-10 h-10 rounded-full object-cover border-2 border-primary/20" loading="lazy" decoding="async" width={40} height={40} />
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-card" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-foreground text-sm">Suporte AloClínica</h2>
              <p className="text-xs text-muted-foreground">Nossa equipe responde por aqui</p>
            </div>
            <Badge variant="outline" className={`text-[10px] ${statusConf.color}`}>{statusConf.label}</Badge>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-1" ref={scrollRef}>
            <div className="space-y-4 py-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <img src={pingoSupport} alt="Suporte AloClínica" className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-primary/20" loading="lazy" decoding="async" width={64} height={64} />
                  <p className="text-sm text-foreground font-medium">Olá! Você está no suporte da AloClínica. 🐧</p>
                  <p className="text-sm text-muted-foreground mt-2">Escreva sua dúvida que nossa equipe responde por aqui.</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.sender_role === "patient" ? "justify-end" : "justify-start"}`}>
                  {msg.sender_role === "support" && (
                    <img src={pingoSupport} alt="Dr. Pinguim" className="w-8 h-8 rounded-full object-cover shrink-0 mt-1" loading="lazy" decoding="async" width={32} height={32} />
                  )}
                  <div className="max-w-[80%]">
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                      {msg.sender_role === "patient" && " • Entregue"}
                    </span>
                    <div className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap mt-0.5 ${
                      msg.sender_role === "patient"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}>
                      {msg.content}
                    </div>
                    {/* Inline shortcut card example */}
                    {msg.sender_role === "support" && msg.content.includes("Consultas") && (
                      <button className="mt-2 flex items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors w-full text-left"
                        onClick={() => navigate("/dashboard/appointments")}>
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1"><p className="text-xs font-bold text-muted-foreground uppercase">Atalho</p><p className="text-sm font-medium text-foreground">Ir para Consultas</p></div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  {msg.sender_role === "patient" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Quick actions */}
          {selectedTicket.status !== "closed" && (
            <div className="flex gap-2 flex-wrap py-2">
              {QUICK_ACTIONS.map(action => (
                <Button key={action.label} variant="outline" size="sm" className="rounded-xl text-xs font-bold gap-1.5 h-9"
                  onClick={() => { setInput(action.label.toLowerCase()); }}>
                  <action.icon className="w-3.5 h-3.5" /> {action.label}
                </Button>
              ))}
            </div>
          )}

          {/* Input */}
          {selectedTicket.status !== "closed" ? (
            <div className="flex gap-2 items-center pt-2 border-t border-border">
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label="Anexar arquivo"><Plus className="w-5 h-5" /></Button>
              <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()} placeholder="Escreva sua mensagem..." disabled={sending} className="flex-1 h-11 rounded-2xl" />
              <Button size="icon" className="h-10 w-10 rounded-full bg-primary text-primary-foreground" onClick={sendMessage} disabled={sending || !input.trim()} aria-label="Enviar mensagem">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <div className="p-3 border-t border-border text-center"><p className="text-sm text-muted-foreground">Este atendimento foi encerrado.</p></div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // Tickets list
  return (
    <DashboardLayout title="Paciente" nav={nav} role="patient">
      <div className="w-full mx-auto max-w-2xl pb-24 md:pb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard?role=patient")} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </Button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Suporte</h1>
            <p className="text-sm text-muted-foreground">Fale com nossa equipe de atendimento</p>
          </div>
          <Button onClick={createNewTicket} className="gap-2"><Plus className="w-4 h-4" /> Novo Atendimento</Button>
        </div>

        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center">
            <img src={pingoSupport} alt="Pingo" className="w-20 h-20 object-contain mx-auto drop-shadow-md mb-3 select-none" loading="lazy" decoding="async" width={80} height={80} />
            <p className="text-[13px] font-semibold text-foreground">Nenhum atendimento aberto</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Atendimento" para falar com nossa equipe.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(ticket => {
              const statusConf = STATUS_LABELS[ticket.status] ?? STATUS_LABELS.bot;
              return (
                <motion.div key={ticket.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl border border-border bg-card hover:bg-muted/30 cursor-pointer transition-colors flex items-center gap-3"
                  onClick={() => setSelectedTicket(ticket)}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ticket.status === "in_service" ? "bg-success/10" : ticket.status === "waiting_human" ? "bg-warning/10" : "bg-muted"}`}>
                    {ticket.status === "closed" ? <CheckCircle className="w-5 h-5 text-muted-foreground" /> : ticket.status === "in_service" ? <Headset className="w-5 h-5 text-success" /> : <Clock className="w-5 h-5 text-warning" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true, locale: ptBR })}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${statusConf.color}`}>{statusConf.label}</Badge>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientSupportChat;
