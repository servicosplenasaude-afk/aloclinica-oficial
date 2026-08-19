import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FlaskConical, Headphones, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import telemedicineImage from "@/assets/card-teleconsulta.webp";
import examsImage from "@/assets/card-agendar.webp";
import supportImage from "@/assets/card-suporte.webp";

const campaignCards = [
  {
    title: "Telemedicina acolhedora",
    description: "Atendimento online com profissionais de saúde sem sair de casa.",
    image: telemedicineImage,
    icon: Video,
    action: "Falar com especialista",
    href: "/teleconsulta",
    tone: "from-blue-500 to-cyan-500",
  },
  {
    title: "Agende sua consulta",
    description: "Marque seu atendimento e acompanhe tudo em um só lugar.",
    image: examsImage,
    icon: FlaskConical,
    action: "Agendar",
    href: "/agendar",
    tone: "from-emerald-500 to-teal-500",
  },
  {
    title: "Suporte que acompanha",
    description: "Histórico, orientação e ajuda humana para continuar o cuidado.",
    image: supportImage,
    icon: Headphones,
    action: "Central de ajuda",
    href: "/ajuda",
    tone: "from-amber-400 to-orange-500",
  },
];

const PingoCampaignShowcase = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-white py-14 sm:py-16 lg:py-20" aria-label="Destaques de cuidado AloClinica">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(11,99,246,0.08),transparent_30%),radial-gradient(circle_at_85%_70%,rgba(242,140,24,0.08),transparent_28%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-9 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#f28c18]">
              Cuidado visual, simples e próximo
            </span>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#0b2f73] sm:text-4xl lg:text-5xl">
              Uma experiência mais clara para quem precisa cuidar da saúde.
            </h2>
          </div>
          <Button
            type="button"
            onClick={() => navigate("/agendar")}
            className="h-12 w-fit rounded-xl bg-[#0b63f6] px-6 font-bold text-white shadow-lg shadow-blue-700/20 hover:bg-[#064fc7]"
          >
            Agendar consulta
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {campaignCards.map((card, index) => {
            const Icon = card.icon;

            return (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="public-card group overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_18px_60px_-32px_rgba(11,47,115,0.45)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#eaf5ff]">
                  <div className={`absolute inset-x-0 top-0 z-10 h-1.5 bg-gradient-to-r ${card.tone}`} />
                  <img
                    src={card.image}
                    alt={card.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b2f73]/25 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                </div>
                <div className="flex min-h-[168px] flex-col justify-between p-5">
                  <div>
                    <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.tone} text-white shadow-lg shadow-blue-900/10`}>
                      <Icon className="h-5 w-5" strokeWidth={2.4} />
                    </div>
                    <h3 className="text-xl font-extrabold text-[#0b2f73]">{card.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(card.href)}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#0b63f6] transition hover:text-[#f28c18]"
                  >
                    {card.action}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PingoCampaignShowcase;
