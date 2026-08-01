import { forwardRef, lazy } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/landing/Header";
import SEOHead from "@/components/SEOHead";
import teleconsultaHero from "@/assets/hero-teleconsulta.png";
import dashboardRef from "@/assets/ref-dashboard-1.png";

const Footer = lazy(() => import("@/components/landing/Footer"));

const services = [
  {
    id: 1,
    title: "Teleconsulta Médica",
    description: "Consulte especialistas em minutos, não em dias. Videochamada segura, receita digital válida e atestado na hora — tudo sem sair de casa.",
    icon: "🎥",
    image: teleconsultaHero,
    href: "/teleconsulta",
    badge: "⚡ Mais Popular",
    stats: "Desde R$ 89",
    color: "from-blue-500 to-cyan-500",
  },
];

const Servicos = forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();

  return (
    <div ref={ref} className="relative min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 bg-[image:var(--landing-bg)] pointer-events-none" />

      <SEOHead
        title="Serviços | AloClínica - Telemedicina"
        description="Conheça os serviços AloClínica: Teleconsulta médica online com especialistas verificados."
        canonical="https://aloclinica.com.br/servicos"
      />

      <Header />

      {/* Hero */}
      <section className="pt-20 pb-12 px-4">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mb-4">
              ✨ Soluções de Saúde
            </span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-foreground leading-tight mb-6">
              Saúde <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Digitalizada</span>
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium mb-4">
              Atendimento médico online com especialistas verificados — tudo que sua saúde precisa em um só lugar.
            </p>
            <p className="text-base text-muted-foreground/80 max-w-2xl mx-auto">
              De pacientes a clínicas, oferecemos uma plataforma de telemedicina com segurança CFM, conformidade LGPD e tecnologia de ponta.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="section-band band-plain">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, i) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                whileHover={{ y: -8 }}
                className="group flex flex-col rounded-2xl border border-border bg-card overflow-hidden cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300"
                onClick={() => navigate(service.href)}
              >
                {/* Image Header with Overlay */}
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-foreground/5 to-foreground/10">
                  {service.image && (
                    <motion.img
                      src={service.image}
                      alt={service.title}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-300"
                      initial={{ scale: 1 }}
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.4 }}
                    />
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-card opacity-80 group-hover:opacity-60 transition-opacity`} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      className="text-6xl"
                      initial={{ scale: 1 }}
                      whileHover={{ scale: 1.2, rotate: 5 }}
                      transition={{ duration: 0.3 }}
                    >
                      {service.icon}
                    </motion.div>
                  </div>
                  <motion.span
                    className="absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full bg-primary/90 text-primary-foreground backdrop-blur-sm"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                  >
                    {service.badge}
                  </motion.span>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 flex flex-col">
                  <motion.h3
                    className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors duration-300"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {service.title}
                  </motion.h3>
                  <motion.p
                    className="text-sm text-muted-foreground mb-4 flex-1 leading-relaxed"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    {service.description}
                  </motion.p>

                  {/* Stats with Animation */}
                  <motion.div
                    className="text-xs text-muted-foreground mb-4 pt-4 border-t border-border/50 flex items-center gap-1"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                  >
                    <CheckCircle size={14} className="text-primary" weight="fill" />
                    {service.stats}
                  </motion.div>

                  {/* CTA Button */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Button
                      className="w-full bg-gradient-hero text-primary-foreground hover:opacity-90 rounded-xl font-semibold group/btn"
                      onClick={() => navigate(service.href)}
                    >
                      <span className="flex items-center gap-2">
                        Saiba Mais
                        <motion.div
                          whileHover={{ x: 4 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <ArrowRight className="w-4 h-4" weight="bold" />
                        </motion.div>
                      </span>
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-band band-tint">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-20 2xl:px-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
              Por que escolher <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">AloClínica?</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Segurança, conformidade e tecnologia de ponta em todos os serviços.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "🔐 LGPD Compliant", desc: "Seus dados seguros e protegidos" },
              { label: "✓ CFM Regulado", desc: "Médicos verificados e autenticados" },
              { label: "📝 Assinatura Digital", desc: "Documentos válidos juridicamente" },
              { label: "⏰ 24h Disponível", desc: "Atendimento sempre disponível" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
                className="relative p-6 rounded-2xl border border-border/50 bg-card overflow-hidden group"
              >
                {/* Animated background gradient */}
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-primary/5 to-secondary/5"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                />

                <div className="relative z-10">
                  <motion.div
                    className="text-4xl font-bold mb-3"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    transition={{ delay: i * 0.15, type: "spring", stiffness: 200 }}
                  >
                    {item.label.split(" ")[0]}
                  </motion.div>
                  <h4 className="font-semibold text-foreground mb-1">{item.label.split(" ").slice(1).join(" ")}</h4>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-band band-plain">
        {/* Animated background elements */}
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 blur-3xl"
          animate={{ y: [0, 30, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-tr from-secondary/10 to-primary/10 blur-3xl"
          animate={{ y: [0, -30, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
        />

        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <motion.h2
              className="text-4xl sm:text-5xl font-black text-foreground mb-4"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Sua próxima consulta em <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">30 minutos?</span>
            </motion.h2>
            <motion.p
              className="text-muted-foreground text-lg mb-2"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Sem fila. Sem deslocamento. Sem complicação.
            </motion.p>
            <motion.p
              className="text-muted-foreground/70 text-base mb-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              Escolha seu serviço, crie sua conta e marque agora.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                size="lg"
                className="bg-gradient-hero text-primary-foreground hover:opacity-90 rounded-xl px-10 h-14 font-bold text-base shadow-lg hover:shadow-xl transition-all duration-300 group"
                onClick={() => navigate("/paciente")}
              >
                <span className="flex items-center gap-3">
                  Criar Conta Agora
                  <motion.div
                    whileHover={{ x: 4 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <ArrowRight size={20} weight="bold" />
                  </motion.div>
                </span>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
});

Servicos.displayName = "Servicos";
export default Servicos;
