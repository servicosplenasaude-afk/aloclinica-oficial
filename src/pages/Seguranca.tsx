import { forwardRef, lazy } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Shield, Lock, Eye, Database, FileText } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/landing/Header";
import SEOHead from "@/components/SEOHead";

const Footer = lazy(() => import("@/components/landing/Footer"));

const certifications = [
  {
    icon: Shield,
    title: "Em conformidade com o CFM",
    desc: "Plataforma alinhada às normas do Conselho Federal de Medicina para telemedicina.",
    items: ["Resolução CFM 2.314/2022", "Lei 14.510/2022", "Médicos verificados no CFM"],
  },
  {
    icon: Lock,
    title: "LGPD Compliant",
    desc: "Total conformidade com a Lei Geral de Proteção de Dados Pessoais do Brasil.",
    items: ["Criptografia ponta a ponta", "Consentimento explícito", "Direito ao esquecimento"],
  },
  {
    icon: Lock,
    title: "Criptografia AES-256",
    desc: "Dados de saúde protegidos com criptografia AES-256 em repouso e SSL/TLS em trânsito.",
    items: ["Dados em repouso criptografados", "SSL/TLS em trânsito", "Chaves protegidas"],
  },
  {
    icon: FileText,
    title: "Receita ICP-Brasil",
    desc: "Prescrições e atestados com assinatura digital ICP-Brasil, válidos em todo o Brasil.",
    items: ["Assinatura digital ICP-Brasil", "Isolamento de dados por usuário (RLS)", "Trilha de auditoria"],
  },
];

const securityFeatures = [
  {
    title: "Criptografia AES-256",
    desc: "Todos os dados em repouso são criptografados com o padrão AES-256.",
    icon: Lock,
  },
  {
    title: "SSL/TLS em Trânsito",
    desc: "Comunicação segura entre cliente e servidor com protocolo de criptografia moderno.",
    icon: Shield,
  },
  {
    title: "Autenticação Multifator",
    desc: "Proteção com 2FA/MFA para todos os usuários da plataforma.",
    icon: FileText,
  },
  {
    title: "Backup Redundante",
    desc: "Múltiplas cópias em diferentes data centers com replicação em tempo real.",
    icon: Database,
  },
  {
    title: "Monitoramento 24/7",
    desc: "Detecção de anomalias e ameaças com alertas em tempo real.",
    icon: Eye,
  },
  {
    title: "Auditoria Contínua",
    desc: "Registros detalhados de todos os acessos e operações, com prontuários retidos por no mínimo 20 anos, conforme a Res. CFM 1.821/2007.",
    icon: FileText,
  },
];

const privacyPolicies = [
  {
    title: "Coleta de Dados",
    items: [
      "Coletamos apenas dados necessários para prestação de serviço",
      "Consentimento explícito antes de qualquer coleta",
      "Informação clara sobre finalidade de cada dado",
    ],
  },
  {
    title: "Armazenamento",
    items: [
      "Dados armazenados em servidores seguros documentados",
      "Acesso restrito apenas a profissionais autorizados",
      "Segregação de dados por perfil de usuário",
    ],
  },
  {
    title: "Compartilhamento",
    items: [
      "Nunca vendemos dados de pacientes",
      "Compartilhamento apenas com consentimento explícito",
      "Parcerias com terceiros sujeitas a mesmos padrões",
    ],
  },
  {
    title: "Retenção",
    items: [
      "Prontuários retidos por no mínimo 20 anos, conforme a Res. CFM 1.821/2007",
      "Exclusão segura após período legal",
      "Direito do paciente ao esquecimento (LGPD)",
    ],
  },
];

const Seguranca = forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();

  return (
    <div ref={ref} className="relative min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 bg-[image:var(--landing-bg)] pointer-events-none" />

      <SEOHead
        title="Segurança e Conformidade | AloClínica"
        description="Dados protegidos com criptografia AES-256, conformidade LGPD e CFM, e receita com assinatura ICP-Brasil. Sua privacidade é nossa prioridade."
        canonical="https://aloclinica.com.br/seguranca"
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
              Segurança de Dados
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6">
              Sua Privacidade é Nossa <span className="text-primary">Prioridade</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Conformidade total com a legislação brasileira. Seus dados de saúde protegidos com criptografia AES-256.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Certifications Grid */}
      <section className="section-band band-tint band-divider">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground text-center mb-16">
            Certificações & Conformidades
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {certifications.map((cert, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-2xl border border-border bg-background"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <cert.icon className="w-6 h-6 text-primary" weight="fill" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{cert.title}</h3>
                </div>

                <p className="text-muted-foreground mb-4">{cert.desc}</p>

                <ul className="space-y-2">
                  {cert.items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2.5 text-sm text-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0" weight="bold" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="section-band band-plain">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground text-center mb-16">
            Tecnologia de Segurança
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityFeatures.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-primary" weight="fill" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Policies */}
      <section className="section-band band-tint band-divider">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground text-center mb-16">
            Políticas de Privacidade
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {privacyPolicies.map((policy, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-2xl border border-border bg-background"
              >
                <h3 className="text-lg font-bold text-foreground mb-4">{policy.title}</h3>
                <ul className="space-y-3">
                  {policy.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" weight="bold" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Info */}
      <section className="section-band band-plain">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl border-2 border-primary/30 bg-primary/5"
            >
              <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-3">
                <Shield className="w-6 h-6 text-primary" weight="fill" />
                Compromisso com Segurança
              </h3>
              <p className="text-muted-foreground mb-4">
                Na AloClínica, segurança e privacidade não são características opcionais — são valores fundamentais. Cada linha de código, cada conexão de rede, cada acesso ao sistema foi projetado pensando em proteger seus dados de saúde com a máxima segurança possível.
              </p>
              <p className="text-muted-foreground">
                Realizamos auditorias de segurança regularmente, mantemos certificações atualizadas e estamos em constante evolução para enfrentar ameaças emergentes. Sua confiança em nós é sagrada.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Documents & Policies */}
      <section className="section-band band-tint band-divider">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground text-center mb-12">
            Documentos Importantes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              { title: "Política de Privacidade", desc: "Conheça como coletamos, usamos e protegemos seus dados.", href: "/privacy" },
              { title: "Termos de Serviço", desc: "Direitos e responsabilidades dos usuários da plataforma.", href: "/terms" },
              { title: "LGPD & Conformidade", desc: "Detalhes sobre conformidade com legislação de proteção de dados.", href: "/lgpd" },
              { title: "Relatório de Segurança", desc: "Análise anual de nossas práticas e certificações de segurança.", href: "/seguranca" },
            ].map((doc, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-xl border border-border bg-background hover:border-primary/30 transition-all group"
              >
                <FileText className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" weight="fill" />
                <h3 className="font-semibold text-foreground mb-2">{doc.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{doc.desc}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:bg-primary/10"
                  onClick={() => navigate(doc.href)}
                >
                  Acessar documento →
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Security Team */}
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
                  Dúvidas sobre Segurança?
                </h2>
                <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
                  Nossa equipe de segurança está pronta para responder qualquer pergunta sobre proteção de dados.
                </p>
              </div>
              <Button
                size="lg"
                className="bg-background text-primary hover:bg-background/95 rounded-2xl px-8 gap-2.5 font-extrabold"
                onClick={() => navigate("/contato")}
              >
                Fale com Nosso Time
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

Seguranca.displayName = "Seguranca";
export default Seguranca;
