import { lazy, Suspense, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supportContactUrl } from "@/config/compliance";
import { motion } from "framer-motion";
import {
  MagnifyingGlass,
  ChatsCircle,
  Question,
  CalendarBlank,
  CreditCard,
  ShieldCheck,
  User,
  VideoCamera,
  Prescription,
  Headset,
  WhatsappLogo,
  EnvelopeSimple,
  ArrowRight,
} from "@phosphor-icons/react";
import Header from "@/components/landing/Header";
import SEOHead from "@/components/SEOHead";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import pingoSupport from "@/assets/states/pingo-central-ajuda.webp";

const Footer = lazy(() => import("@/components/landing/Footer"));

const categories = [
  { icon: CalendarBlank, title: "Agendamento", desc: "Como marcar, remarcar ou cancelar consultas", color: "bg-blue-500/10 text-blue-600", slug: "agendamento" },
  { icon: VideoCamera, title: "Teleconsulta", desc: "Como funciona o atendimento por vídeo", color: "bg-violet-500/10 text-violet-600", slug: "teleconsulta" },
  { icon: CreditCard, title: "Pagamentos", desc: "Métodos, reembolsos e dúvidas financeiras", color: "bg-emerald-500/10 text-emerald-600", slug: "pagamentos" },
  { icon: Prescription, title: "Receitas e Atestados", desc: "Validade, assinatura digital e download", color: "bg-amber-500/10 text-amber-600", slug: "receitas" },
  { icon: User, title: "Minha Conta", desc: "Cadastro, perfil, dependentes e senha", color: "bg-rose-500/10 text-rose-600", slug: "conta" },
  { icon: ShieldCheck, title: "Privacidade e Segurança", desc: "LGPD, dados pessoais e segurança", color: "bg-teal-500/10 text-teal-600", slug: "seguranca" },
];

const popularQuestions = [
  {
    q: "Como faço para agendar uma consulta?",
    a: "Acesse a página inicial, clique em 'Agendar Consulta', escolha a especialidade e o médico, selecione data e horário disponíveis, faça o pagamento e pronto. Você receberá a confirmação por e-mail e WhatsApp.",
  },
  {
    q: "A receita digital tem validade legal?",
    a: "Sim. Todas as receitas emitidas pela AloClínica são assinadas digitalmente com certificado ICP-Brasil, possuem validade jurídica conforme a Resolução CFM 2.299/2021 e são aceitas em todas as farmácias do Brasil.",
  },
  {
    q: "Posso cancelar uma consulta?",
    a: "Sim. Cancelamentos com mais de 6 horas de antecedência têm reembolso integral. Cancelamentos posteriores ou ausências (no-show) seguem nossa Política de Reembolso.",
  },
  {
    q: "Como funciona a consulta de retorno?",
    a: "Consultas de retorno custam 50% do valor da consulta original e podem ser agendadas em até 60 dias após a primeira consulta com o mesmo médico.",
  },
  {
    q: "Quais formas de pagamento são aceitas?",
    a: "Aceitamos cartão de crédito (Visa, Mastercard, Elo, Amex), PIX e boleto bancário. Para PIX e cartão o pagamento é confirmado em segundos.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Sim. Utilizamos criptografia ponta-a-ponta, servidores no Brasil em conformidade com LGPD e seguimos rigorosamente as diretrizes do CFM. Seus dados nunca são compartilhados sem consentimento.",
  },
  {
    q: "Como adicionar um dependente?",
    a: "No seu painel, vá em 'Dependentes' e clique em 'Adicionar dependente'. Você pode incluir filhos, cônjuges ou pais e gerenciar as consultas de toda a família em uma única conta.",
  },
  {
    q: "O médico pode pedir exames?",
    a: "Sim. Durante a teleconsulta o médico pode emitir solicitação de exames com assinatura digital, válida em laboratórios em todo o Brasil.",
  },
];

const Ajuda = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const filteredQuestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return popularQuestions;
    return popularQuestions.filter(
      (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="relative min-h-screen bg-background">
      <SEOHead
        title="Central de Ajuda - AloClínica | Suporte e Dúvidas"
        description="Encontre respostas rápidas sobre agendamento, teleconsulta, pagamentos, receitas e segurança. Suporte humano por WhatsApp, chat e e-mail."
        canonical="https://aloclinica.com.br/ajuda"
      />

      <Header />

      {/* Hero */}
      <section className="pt-32 pb-12 md:pt-40 md:pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-4 py-1.5 rounded-full mb-5"
          >
            <Question className="w-3.5 h-3.5" weight="fill" />
            Central de Ajuda
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-3xl md:text-5xl font-extrabold text-foreground mb-4 tracking-tight"
          >
            Como podemos <span className="text-gradient">ajudar você?</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-base md:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto"
          >
            Tire suas dúvidas, explore nossos guias ou fale com nossa equipe de suporte humano.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative max-w-xl mx-auto"
          >
            <MagnifyingGlass
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
              weight="bold"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por dúvida, ex: como cancelar consulta"
              className="h-14 pl-12 pr-4 text-base rounded-2xl border-border/50 shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Buscar na central de ajuda"
            />
          </motion.div>
        </div>
      </section>

      {/* Categorias */}
      <section className="section-band band-plain !py-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6 text-center">
            Explore por categoria
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
            {categories.map((cat, i) => (
              <motion.button
                key={cat.slug}
                type="button"
                onClick={() => setQuery(cat.title)}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                whileHover={{ y: -4 }}
                className="text-left bg-card rounded-2xl border border-border/40 p-5 md:p-6 hover:shadow-lg hover:border-primary/15 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl ${cat.color} flex items-center justify-center mb-4`}>
                  <cat.icon className="w-6 h-6" weight="fill" />
                </div>
                <h3 className="text-sm md:text-base font-bold text-foreground mb-1">{cat.title}</h3>
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{cat.desc}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-band band-tint band-divider">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-2 text-center">
            Perguntas frequentes
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-8">
            {filteredQuestions.length} {filteredQuestions.length === 1 ? "resultado" : "resultados"}
            {query ? ` para "${query}"` : ""}
          </p>

          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border/40">
              <Question className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" weight="light" />
              <p className="text-foreground font-medium mb-1">Nenhum resultado encontrado</p>
              <p className="text-sm text-muted-foreground mb-4">Tente outras palavras ou fale com nosso suporte.</p>
              <Button onClick={() => setQuery("")} variant="outline">
                Limpar busca
              </Button>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-3">
              {filteredQuestions.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`q-${i}`}
                  className="bg-card rounded-2xl border border-border/40 px-5 data-[state=open]:border-primary/20 data-[state=open]:shadow-md transition-all"
                >
                  <AccordionTrigger className="text-left text-sm md:text-base font-semibold text-foreground hover:no-underline py-4">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </section>

      {/* Suporte humano */}
      <section className="section-band band-plain">
        <div className="max-w-6xl mx-auto">
          <div className="relative bg-gradient-to-br from-primary/8 via-card to-secondary/8 rounded-3xl border border-primary/15 overflow-hidden">
            <div className="grid md:grid-cols-2 gap-8 items-center p-6 md:p-12">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mb-4">
                  <Headset className="w-3.5 h-3.5" weight="fill" />
                  Suporte humano
                </span>
                <h2 className="text-2xl md:text-4xl font-extrabold text-foreground mb-3 tracking-tight">
                  Não encontrou o que procurava?
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Nossa equipe está disponível de segunda a sábado, das 8h às 22h, para ajudar você por WhatsApp, chat ou e-mail.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="bg-[#25D366] hover:bg-[#1da851] text-white font-bold"
                  >
                    <a
                      href={supportContactUrl("Olá! Preciso de ajuda.")}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <WhatsappLogo className="w-5 h-5 mr-2" weight="fill" />
                      WhatsApp
                    </a>
                  </Button>
                  <Button
                    onClick={() => navigate("/contato")}
                    variant="outline"
                    size="lg"
                    className="font-bold"
                  >
                    <EnvelopeSimple className="w-5 h-5 mr-2" weight="fill" />
                    Enviar mensagem
                  </Button>
                </div>

                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <Link to="/faq" className="hover:text-primary inline-flex items-center gap-1 font-medium">
                    FAQ completo <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                  </Link>
                  <Link to="/contato" className="hover:text-primary inline-flex items-center gap-1 font-medium">
                    Página de contato <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                  </Link>
                  <Link to="/seguranca" className="hover:text-primary inline-flex items-center gap-1 font-medium">
                    Segurança <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                  </Link>
                </div>
              </div>

              <div className="relative hidden md:flex justify-center items-center">
                <img
                  src={pingoSupport}
                  alt="Pingo, mascote da AloClínica, pronto para ajudar"
                  className="w-72 h-72 object-contain drop-shadow-2xl"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute -top-2 right-8 bg-card rounded-2xl rounded-bl-sm px-4 py-3 border border-border/40 shadow-lg max-w-[200px]">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <ChatsCircle className="w-4 h-4 text-primary" weight="fill" />
                    Estou aqui pra ajudar!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default Ajuda;
