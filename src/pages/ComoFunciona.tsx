import { forwardRef, lazy } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Download, Notebook, Video, FileText, CheckCircle } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/landing/Header";
import SEOHead from "@/components/SEOHead";

const Footer = lazy(() => import("@/components/landing/Footer"));

const patientSteps = [
  {
    step: "1",
    title: "Criar Conta",
    desc: "Cadastro rápido com nome, email e CPF. Aprovação instantânea.",
    icon: Notebook,
    time: "2 min",
    details: ["Dados pessoais", "Verificação de email", "Confirmar CPF"],
  },
  {
    step: "2",
    title: "Escolher Especialista",
    desc: "Navegue entre 30+ especialidades com filtros avançados.",
    icon: Download,
    time: "3 min",
    details: ["Filtro por especialidade", "Ver avaliações", "Agendar horário"],
  },
  {
    step: "3",
    title: "Agendar Consulta",
    desc: "Escolha um horário disponível. Consulta confirmada em segundos.",
    icon: FileText,
    time: "1 min",
    details: ["Horários livres", "Forma de pagamento", "Confirmação"],
  },
  {
    step: "4",
    title: "Fazer a Consulta",
    desc: "Videoconferência segura com médico. Receita e atestado digitais.",
    icon: Video,
    time: "15-30 min",
    details: ["Chat + vídeo", "Compartilhar documentos", "Prescrever"],
  },
  {
    step: "5",
    title: "Receber Resultado",
    desc: "Receita, atestado e prontuário acessíveis na plataforma para sempre.",
    icon: CheckCircle,
    time: "Imediato",
    details: ["Receita digital", "Atestado PDF", "Acesso ao prontuário"],
  },
];

const doctorSteps = [
  {
    step: "1",
    title: "Cadastro Médico",
    desc: "Preencha CRM, especialidade e horários. Verificação em 24h.",
    icon: Notebook,
    details: ["CRM validado", "Especialidade", "Documentos"],
  },
  {
    step: "2",
    title: "Configurar Agenda",
    desc: "Defina seus horários de atendimento e valor de consulta.",
    icon: FileText,
    details: ["Horários flexíveis", "Valor por consulta", "Perfil público"],
  },
  {
    step: "3",
    title: "Receber Pacientes",
    desc: "Pacientes agendando com você automaticamente. Notificações em tempo real.",
    icon: Notebook,
    details: ["Notificações", "Fila inteligente", "Confirmações"],
  },
  {
    step: "4",
    title: "Atender Online",
    desc: "Video, chat, prescrever e gerar atestados tudo em um lugar.",
    icon: Video,
    details: ["Prontuário SOAP", "Prescrição digital", "Atestado"],
  },
  {
    step: "5",
    title: "Ganhar Renda",
    desc: "Receba por consulta realizada. Saque mensal automático.",
    icon: CheckCircle,
    details: ["Faturamento claro", "Saque automático", "Relatórios"],
  },
];

const ComoFunciona = forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();

  return (
    <div ref={ref} className="relative min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 bg-[image:var(--landing-bg)] pointer-events-none" />

      <SEOHead
        title="Como Funciona AloClínica - Guia Completo"
        description="Entenda passo a passo como funciona o agendamento de consultas online, desde o cadastro até o atendimento."
        canonical="https://aloclinica.com.br/como-funciona"
      />

      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mb-4">
              Guia Passo a Passo
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6">
              Como <span className="text-primary">Funciona</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Conheça o fluxo simples e intuitivo da AloClínica. Consulta agendada em menos de 2 minutos.
            </p>
          </motion.div>

          {/* Metrics strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-12"
          >
            {[
              { value: "2 min", label: "para agendar" },
              { value: "30+", label: "especialidades" },
              { value: "24h", label: "disponível todos os dias" },
              { value: "CFM", label: "médicos verificados" },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * i }}
                className="text-center p-4 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm"
              >
                <div className="text-2xl sm:text-3xl font-black text-primary">{m.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Tabs */}
      <section className="section-band band-plain">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              size="lg"
              className="rounded-full bg-gradient-hero text-primary-foreground hover:opacity-90 font-semibold h-12"
              onClick={() => document.getElementById("patient-flow")?.scrollIntoView({ behavior: "smooth" })}
            >
              👤 Sou Paciente
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full font-semibold h-12"
              onClick={() => document.getElementById("doctor-flow")?.scrollIntoView({ behavior: "smooth" })}
            >
              👨‍⚕️ Sou Médico
            </Button>
          </div>

          {/* Patient Flow */}
          <div id="patient-flow" className="mb-32">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground text-center mb-16">
              Fluxo Para Pacientes
            </h2>

            <div className="space-y-8">
              {patientSteps.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative"
                >
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
                    {/* Step Number */}
                    <div className="md:col-span-1 flex justify-center md:justify-start">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-hero shadow-lg shadow-primary/20 flex items-center justify-center">
                        <span className="text-3xl font-extrabold text-primary-foreground">{item.step}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="md:col-span-3">
                      <h3 className="text-2xl font-bold text-foreground mb-2">{item.title}</h3>
                      <p className="text-muted-foreground mb-4">{item.desc}</p>
                      <div className="flex flex-wrap gap-2">
                        {item.details.map((detail, idx) => (
                          <span
                            key={idx}
                            className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary"
                          >
                            {detail}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Time */}
                    <div className="md:col-span-1 text-center md:text-right">
                      <div className="text-sm font-medium text-muted-foreground mb-1">Tempo</div>
                      <div className="text-2xl font-bold text-primary">{item.time}</div>
                    </div>
                  </div>

                  {/* Arrow */}
                  {i < patientSteps.length - 1 && (
                    <div className="hidden md:flex justify-center mt-8 mb-8">
                      <ArrowRight className="w-8 h-8 text-border rotate-90" weight="bold" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mt-16"
            >
              <Button
                size="lg"
                className="bg-gradient-hero text-primary-foreground hover:opacity-90 rounded-xl px-8 gap-2 font-semibold h-12"
                onClick={() => navigate("/paciente/cadastro")}
              >
                Começar Agora
                <ArrowRight className="w-5 h-5" weight="bold" />
              </Button>
            </motion.div>
          </div>

          {/* Doctor Flow */}
          <div id="doctor-flow" className="pt-20 border-t border-border">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground text-center mb-16">
              Fluxo Para Médicos
            </h2>

            <div className="space-y-8">
              {doctorSteps.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative"
                >
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
                    {/* Step Number */}
                    <div className="md:col-span-1 flex justify-center md:justify-start">
                      <div className="w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary flex items-center justify-center">
                        <span className="text-3xl font-extrabold text-primary">{item.step}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="md:col-span-3">
                      <h3 className="text-2xl font-bold text-foreground mb-2">{item.title}</h3>
                      <p className="text-muted-foreground mb-4">{item.desc}</p>
                      <div className="flex flex-wrap gap-2">
                        {item.details.map((detail, idx) => (
                          <span
                            key={idx}
                            className="text-xs font-medium px-3 py-1 rounded-full bg-secondary/10 text-secondary-foreground"
                          >
                            {detail}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Icon */}
                    <div className="md:col-span-1 text-center md:text-right">
                      <item.icon className="w-12 h-12 text-primary mx-auto md:mx-0" weight="fill" />
                    </div>
                  </div>

                  {/* Arrow */}
                  {i < doctorSteps.length - 1 && (
                    <div className="hidden md:flex justify-center mt-8 mb-8">
                      <ArrowRight className="w-8 h-8 text-border rotate-90" weight="bold" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mt-16"
            >
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-8 gap-2 font-semibold h-12"
                onClick={() => navigate("/para-medicos")}
              >
                Ser Médico Parceiro
                <ArrowRight className="w-5 h-5" weight="bold" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section-band band-tint band-divider">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground text-center mb-12">
            O Que Torna Simples
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { title: "Sem Burocracia", desc: "Nenhum formulário complicado ou aprovações" },
              { title: "Acesso Rápido", desc: "Consulta agendada em menos de 2 minutos" },
              { title: "24 Horas", desc: "Atendimento disponível dia e noite" },
              { title: "Seguro & Privado", desc: "Criptografia AES-256 em toda comunicação" },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-xl border border-border bg-background"
              >
                <Check className="w-6 h-6 text-primary mb-3" weight="bold" />
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-band band-plain">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground text-center mb-12">
            Dúvidas Comuns
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              { q: "Preciso de internet boa?", a: "Uma conexão 3G+ é suficiente. A plataforma otimiza qualidade baseado na sua velocidade." },
              { q: "Posso usar pelo celular?", a: "Sim! A plataforma é 100% otimizada para celular, direto pelo navegador." },
              { q: "Como pagamento funciona?", a: "Cartão, PIX ou débito. Cobrança apenas após consulta realizada." },
              { q: "Meus dados estão seguros?", a: "Criptografia AES-256, conformidade LGPD/CFM, backups diários." },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-xl border border-border bg-card"
              >
                <h3 className="font-semibold text-foreground mb-2">{item.q}</h3>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="section-band band-plain">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden bg-gradient-hero shadow-elevated"
          >
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary-foreground)/0.22),transparent_38%),radial-gradient(circle_at_bottom_right,hsl(var(--primary-foreground)/0.14),transparent_34%)]" />
            <div className="relative z-10 flex flex-col items-center justify-center gap-6 px-6 sm:px-10 py-16 sm:py-20 text-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-foreground mb-2">
                  Pronto para começar?
                </h2>
                <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
                  Consulta agendada em menos de 2 minutos. Sem carência, sem burocracia.
                </p>
              </div>
              <Button
                size="lg"
                className="bg-background text-primary hover:bg-background/95 rounded-2xl px-8 gap-2.5 font-extrabold"
                onClick={() => navigate("/paciente/cadastro")}
              >
                Agendar Agora
                <ArrowRight className="w-5 h-5" weight="bold" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
});

ComoFunciona.displayName = "ComoFunciona";
export default ComoFunciona;
