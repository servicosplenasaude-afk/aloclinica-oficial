import { forwardRef, lazy, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Envelope, Phone, MapPin, PaperPlaneRight, CheckCircle } from "@phosphor-icons/react";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/landing/Header";
import SEOHead from "@/components/SEOHead";

const Footer = lazy(() => import("@/components/landing/Footer"));

const contactMethods = [
  {
    icon: Envelope,
    title: "Email",
    value: "contato@aloclinica.com.br",
    desc: "Resposta em até 2 horas úteis",
  },
  {
    icon: Phone,
    title: "Telefone",
    value: "+55 11 98765-4321",
    desc: "Seg-Sex, 8h-18h",
  },
  {
    icon: MapPin,
    title: "Escritório",
    value: "São Paulo, SP",
    desc: "Atendimento por agendamento",
  },
];

const Contato = forwardRef<HTMLDivElement>((_, ref) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate submission
    setTimeout(() => {
      setSubmitted(true);
      setTimeout(() => {
        setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
        setSubmitted(false);
      }, 3000);
    }, 1000);
  };

  return (
    <div ref={ref} className="relative min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 bg-[image:var(--landing-bg)] pointer-events-none" />

      <SEOHead
        title="Contato | AloClínica - Estamos Aqui para Ajudar"
        description="Entre em contato conosco por email, telefone ou formulário. Resposta rápida garantida."
        canonical="https://aloclinica.com.br/contato"
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
              Fale Conosco
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6">
              Sempre Pronto para <span className="text-primary">Ajudar</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Dúvidas, sugestões ou problemas? Nossa equipe está disponível para responder.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="section-band band-tint band-divider">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {contactMethods.map((method, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-8 rounded-2xl border border-border bg-background"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <method.icon className="w-7 h-7 text-primary" weight="fill" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{method.title}</h3>
                <p className="text-primary font-semibold mb-2">{method.value}</p>
                <p className="text-sm text-muted-foreground">{method.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="section-band band-plain">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="bg-card rounded-2xl border border-border p-8 sm:p-12">
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mb-4"
                  >
                    <CheckCircle className="w-16 h-16 text-green-500" weight="fill" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    Mensagem Enviada!
                  </h3>
                  <p className="text-muted-foreground max-w-sm">
                    Obrigado por entrar em contato. Nossa equipe responderá em breve.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Nome Completo
                      </label>
                      <Input
                        type="text"
                        placeholder="Seu nome"
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Email
                      </label>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        required
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Telefone (Opcional)
                      </label>
                      <Input
                        type="tel"
                        placeholder="+55 11 98765-4321"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Assunto
                      </label>
                      <select
                        required
                        value={formData.subject}
                        onChange={(e) =>
                          setFormData({ ...formData, subject: e.target.value })
                        }
                        className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">Selecione um assunto</option>
                        <option value="suporte">Suporte Técnico</option>
                        <option value="duvida">Dúvida Geral</option>
                        <option value="empresa">Proposta Empresarial</option>
                        <option value="parceria">Parceria</option>
                        <option value="feedback">Feedback</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Mensagem
                    </label>
                    <Textarea
                      placeholder="Conte-nos como podemos ajudar..."
                      required
                      rows={6}
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      className="w-full"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-gradient-hero text-primary-foreground hover:opacity-90 rounded-xl font-semibold h-12 gap-2"
                  >
                    <PaperPlaneRight className="w-5 h-5" weight="fill" />
                    Enviar Mensagem
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Responderemos em até 2 horas úteis. Sua privacidade é respeitada.
                  </p>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Quick Links */}
      <section className="section-band band-tint band-divider">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground text-center mb-12">
            Perguntas Frequentes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {[
              {
                q: "Como agendar uma consulta?",
                a: "Faça login na sua conta, escolha a especialidade e agende com o primeiro horário disponível.",
              },
              {
                q: "Qual é o horário de funcionamento?",
                a: "Disponibilizamos consultas 24 horas por dia, 7 dias por semana.",
              },
              {
                q: "Como me tornar um médico parceiro?",
                a: "Visite /para-medicos e preencha o formulário de cadastro. Aprovação em até 24h.",
              },
              {
                q: "Como funciona o suporte técnico?",
                a: "Suporte disponível por chat, email e telefone durante horário comercial.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-xl border border-border bg-background"
              >
                <h3 className="font-semibold text-foreground mb-2">{item.q}</h3>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
});

Contato.displayName = "Contato";
export default Contato;
