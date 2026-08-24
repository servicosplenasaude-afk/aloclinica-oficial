import { lazy } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Video,
  ShieldCheck,
  FirstAid,
  Heartbeat,
  ChatsCircle,
  Globe,
  Lock,
  Cpu,
  ArrowRight,
  Check,
} from "@phosphor-icons/react";
import Header from "@/components/landing/Header";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import heroTeleconsulta from "@/assets/visual-system/pingo-porque-nos.webp";

const Footer = lazy(() => import("@/components/landing/Footer"));

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true } as const,
};

const PorqueNos = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-background">
      <SEOHead
        title="Por que escolher a AloClínica"
        description="Diferenciais que tornam a AloClínica uma plataforma de saúde digital simples, segura e acessível."
        canonical="https://aloclinica.com.br/sobre/porque-nos"
      />
      <Header />

      {/* HERO */}
      <section className="pt-32 pb-16 md:pb-20 px-4">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-4 py-1.5 rounded-full mb-5">
              <Heart className="w-3.5 h-3.5" weight="fill" /> Por que nós
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold leading-[1.08] mb-6">
              Tudo o que você espera <span className="text-gradient">de uma clínica digital</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
              Atendimento 24h, médicos verificados, prescrição válida em todo país e proteção total
              dos seus dados. Saúde simples, séria e do seu jeito.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="rounded-2xl h-[54px] px-8 gap-2 group" onClick={() => navigate("/agendar")}>
                Quero agendar
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" weight="bold" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-2xl h-[54px] px-8 border-2" onClick={() => navigate("/sobre/depoimentos")}>
                Ver depoimentos
              </Button>
            </div>
          </motion.div>

          <motion.div className="relative flex justify-center" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }}>
            <div className="absolute inset-0 bg-primary/[0.06] blur-[60px] rounded-full scale-75 -z-10" />
            <img src={heroTeleconsulta} alt="Tecnologia AloClínica" loading="lazy" width={512} height={512} className="w-full max-w-[420px] lg:max-w-[460px] drop-shadow-xl relative z-10" />
          </motion.div>
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-12" {...fadeUp}>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">Diferenciais que importam</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              O que oferecemos para cuidar de você e da sua família com segurança.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Video, title: "Consulta 24h", desc: "Atendimento médico disponível a qualquer hora, todos os dias." },
              { icon: FirstAid, title: "30+ Especialidades", desc: "De clínico geral à cardiologia, dermatologia e muito mais." },
              { icon: ShieldCheck, title: "Médicos Verificados", desc: "Todos validados pelo CRM e por processo rigoroso de seleção." },
              { icon: Heartbeat, title: "Prontuário Digital", desc: "Histórico completo, seguro e acessível de qualquer lugar." },
              { icon: ChatsCircle, title: "Suporte Humano", desc: "Equipe dedicada para apoiar em qualquer etapa do atendimento." },
              { icon: Globe, title: "Acesso Nacional", desc: "Mesma qualidade e agilidade em todo o Brasil." },
            ].map((item, i) => (
              <motion.div
                key={i}
                {...fadeUp}
                transition={{ delay: i * 0.06 }}
                className="p-6 rounded-2xl border border-border bg-background hover:border-primary/30 hover:-translate-y-1 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-primary" weight="fill" />
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SEGURANÇA */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-12" {...fadeUp}>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-4 py-1.5 rounded-full mb-4">
              <Lock className="w-3.5 h-3.5" weight="fill" /> Segurança
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">Seus dados, sempre protegidos</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Padrões rigorosos de segurança em conformidade com LGPD, CFM e melhores práticas internacionais.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              { title: "LGPD Compliant", desc: "Proteção total dos seus dados pessoais." },
              { title: "Conformidade com o CFM", desc: "Em conformidade com o Conselho Federal de Medicina (Res. 2.314/2022)." },
              { title: "Criptografia E2E", desc: "Comunicações ponta a ponta protegidas." },
              { title: "Backup Contínuo", desc: "Redundância e backup automático 24/7." },
              { title: "Criptografia AES-256", desc: "Dados protegidos com criptografia de padrão avançado." },
              { title: "Auditoria", desc: "Logs e auditoria de todas as operações." },
            ].map((item, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card/60">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" weight="bold" />
                <div>
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="relative rounded-3xl overflow-hidden bg-gradient-hero p-10 sm:p-14 text-center shadow-elevated">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary-foreground)/0.22),transparent_38%)]" />
            <div className="relative z-10">
              <Cpu className="w-10 h-10 text-primary-foreground/90 mx-auto mb-3" weight="fill" />
              <h3 className="text-2xl sm:text-3xl font-extrabold text-primary-foreground mb-3">
                Experimente a saúde do futuro
              </h3>
              <p className="text-primary-foreground/85 max-w-xl mx-auto mb-6">
                Cuide da sua saúde com praticidade, segurança e médicos verificados.
              </p>
              <Button size="lg" className="bg-background text-primary hover:bg-background/95 rounded-2xl px-8 gap-2 font-extrabold" onClick={() => navigate("/agendar")}>
                Agendar Consulta <ArrowRight className="w-5 h-5" weight="bold" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PorqueNos;
