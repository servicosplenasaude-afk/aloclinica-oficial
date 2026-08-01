import { lazy, Suspense, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Stethoscope,
  ShieldCheck,
  VideoCamera,
  Prescription,
  CaretLeft,
} from "@phosphor-icons/react";
import Header from "@/components/landing/Header";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { PINGO_SPECIALTIES } from "@/constants/specialties-assets";
import pingoFallback from "@/assets/pingo-clinico-geral.jpg";

const Footer = lazy(() => import("@/components/landing/Footer"));

interface SpecialtyContent {
  name: string;
  slug: string;
  image: string;
  shortDesc: string;
  longDesc: string;
  treats: string[];
  whenToSeek: string[];
  fromPrice: number;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const SPECIALTIES_DATA: SpecialtyContent[] = [
  {
    name: "Cardiologia",
    slug: "cardiologia",
    image: PINGO_SPECIALTIES["Cardiologia"],
    shortDesc: "Especialidade médica focada no diagnóstico e tratamento de doenças do coração e do sistema circulatório.",
    longDesc:
      "O cardiologista é o médico especializado em prevenir, diagnosticar e tratar doenças cardiovasculares. Por teleconsulta, você pode realizar avaliações clínicas, interpretação de exames como eletrocardiograma e ecocardiograma, ajuste de medicações para hipertensão e colesterol, além de receber orientações sobre prevenção de infarto e AVC.",
    treats: [
      "Hipertensão arterial",
      "Arritmias cardíacas",
      "Colesterol e triglicerídeos elevados",
      "Insuficiência cardíaca",
      "Doença arterial coronariana",
      "Acompanhamento pós-infarto",
    ],
    whenToSeek: [
      "Dor ou aperto no peito",
      "Falta de ar em repouso ou esforço",
      "Palpitações e batimentos irregulares",
      "Histórico familiar de doenças cardíacas",
      "Pressão alta sem controle",
    ],
    fromPrice: 89,
  },
  {
    name: "Dermatologia",
    slug: "dermatologia",
    image: PINGO_SPECIALTIES["Dermatologia"],
    shortDesc: "Cuidado especializado com a pele, cabelos, unhas e mucosas, do diagnóstico clínico ao tratamento estético.",
    longDesc:
      "O dermatologista atua na prevenção, diagnóstico e tratamento de doenças da pele, cabelos e unhas. Por teleconsulta, é possível avaliar lesões com fotos em alta resolução, prescrever tratamentos para acne, dermatites, queda de cabelo e ainda obter orientação para procedimentos estéticos presenciais.",
    treats: [
      "Acne e cravos",
      "Manchas na pele e melasma",
      "Queda de cabelo e calvície",
      "Dermatite atópica e psoríase",
      "Micoses e infecções de pele",
      "Avaliação de pintas e sinais",
    ],
    whenToSeek: [
      "Acne persistente",
      "Manchas que mudaram de cor ou tamanho",
      "Coceira intensa ou descamação",
      "Queda de cabelo acentuada",
      "Lesões que não cicatrizam",
    ],
    fromPrice: 79,
  },
  {
    name: "Pediatria",
    slug: "pediatria",
    image: PINGO_SPECIALTIES["Pediatria"],
    shortDesc: "Atendimento médico dedicado à saúde de bebês, crianças e adolescentes, do nascimento à adolescência.",
    longDesc:
      "O pediatra acompanha o crescimento e desenvolvimento das crianças, oferecendo cuidados preventivos, vacinação, orientação alimentar e tratamento de doenças comuns da infância. Por teleconsulta é possível tirar dúvidas urgentes, avaliar sintomas como febre, tosse e diarreia, e receber receitas e orientações imediatas.",
    treats: [
      "Febre e gripes",
      "Diarreia e vômitos",
      "Alergias e rinite",
      "Crescimento e desenvolvimento",
      "Orientação de aleitamento e alimentação",
      "Sono infantil",
    ],
    whenToSeek: [
      "Febre persistente",
      "Tosse ou dificuldade para respirar",
      "Falta de apetite e perda de peso",
      "Atrasos no desenvolvimento",
      "Acompanhamento de rotina (puericultura)",
    ],
    fromPrice: 75,
  },
  {
    name: "Psiquiatria",
    slug: "psiquiatria",
    image: PINGO_SPECIALTIES["Psiquiatria"],
    shortDesc: "Cuidado da saúde mental com diagnóstico e tratamento de transtornos emocionais e psicológicos.",
    longDesc:
      "O psiquiatra é o médico que diagnostica e trata transtornos mentais, podendo prescrever medicações quando necessário. A teleconsulta em psiquiatria é totalmente regulamentada pelo CFM e oferece privacidade, conforto e a mesma qualidade do atendimento presencial.",
    treats: [
      "Depressão e tristeza profunda",
      "Ansiedade e síndrome do pânico",
      "Insônia e distúrbios do sono",
      "Burnout e esgotamento",
      "TDAH em adultos",
      "Transtorno bipolar",
    ],
    whenToSeek: [
      "Tristeza ou desânimo persistentes",
      "Crises de ansiedade ou pânico",
      "Dificuldade para dormir",
      "Mudanças bruscas de humor",
      "Pensamentos negativos recorrentes",
    ],
    fromPrice: 119,
  },
  {
    name: "Clínico Geral",
    slug: "clinico-geral",
    image: PINGO_SPECIALTIES["Clínico Geral"],
    shortDesc: "Primeiro contato médico para avaliação ampla, diagnóstico e encaminhamento adequado.",
    longDesc:
      "O clínico geral é o médico que acolhe você em qualquer queixa de saúde. Avalia sintomas, faz diagnóstico inicial, prescreve tratamentos para condições comuns e orienta sobre quando procurar um especialista. Ideal para a maioria das demandas do dia a dia.",
    treats: [
      "Gripes, resfriados e febre",
      "Infecções urinárias",
      "Dores leves a moderadas",
      "Renovação de receitas",
      "Atestados médicos",
      "Avaliação geral de exames",
    ],
    whenToSeek: [
      "Sintomas comuns sem diagnóstico",
      "Necessidade de atestado médico",
      "Renovação de medicação contínua",
      "Avaliação inicial antes de especialista",
    ],
    fromPrice: 59,
  },
  {
    name: "Ginecologia",
    slug: "ginecologia",
    image: PINGO_SPECIALTIES["Ginecologista-obstetra"],
    shortDesc: "Saúde da mulher em todas as fases da vida, com cuidado, escuta e privacidade.",
    longDesc:
      "O ginecologista cuida da saúde íntima e reprodutiva da mulher. Por teleconsulta é possível tirar dúvidas, ajustar contracepção, tratar infecções recorrentes, planejar gravidez e receber orientações sobre TPM, menopausa e cuidados preventivos.",
    treats: [
      "Cólicas e TPM",
      "Métodos contraceptivos",
      "Infecções urinárias e candidíase",
      "Reposição hormonal",
      "Planejamento familiar",
      "Acompanhamento da menopausa",
    ],
    whenToSeek: [
      "Dores pélvicas",
      "Atraso ou alterações menstruais",
      "Sintomas de infecção íntima",
      "Dúvidas sobre contracepção",
      "Sintomas da menopausa",
    ],
    fromPrice: 89,
  },
  {
    name: "Endocrinologia",
    slug: "endocrinologia",
    image: PINGO_SPECIALTIES["Endocrinologia"],
    shortDesc: "Especialista em hormônios, diabetes, tireoide e metabolismo.",
    longDesc:
      "O endocrinologista trata das glândulas e dos hormônios do corpo, cuidando de condições como diabetes, problemas de tireoide, obesidade e distúrbios hormonais. A teleconsulta é ideal para acompanhamento contínuo, ajuste de doses e orientação alimentar.",
    treats: [
      "Diabetes tipo 1 e 2",
      "Hipotireoidismo e hipertireoidismo",
      "Obesidade e sobrepeso",
      "Resistência à insulina",
      "Distúrbios hormonais",
      "Colesterol alterado",
    ],
    whenToSeek: [
      "Cansaço excessivo sem causa aparente",
      "Ganho ou perda rápida de peso",
      "Sede e urina em excesso",
      "Queda de cabelo e pele seca",
      "Acompanhamento de diabetes",
    ],
    fromPrice: 99,
  },
  {
    name: "Nutrição",
    slug: "nutricao",
    image: PINGO_SPECIALTIES["Nutricionista"],
    shortDesc: "Plano alimentar individualizado para emagrecimento, ganho de massa e saúde geral.",
    longDesc:
      "O nutricionista elabora estratégias alimentares personalizadas para seus objetivos de saúde, emagrecimento ou ganho de massa muscular. Por teleconsulta o profissional avalia sua rotina, faz cálculos individualizados e envia o plano completo direto pelo aplicativo.",
    treats: [
      "Emagrecimento saudável",
      "Ganho de massa muscular",
      "Reeducação alimentar",
      "Alimentação para diabetes",
      "Suplementação esportiva",
      "Alimentação infantil",
    ],
    whenToSeek: [
      "Dificuldade para emagrecer",
      "Sem orientação nutricional",
      "Restrições alimentares ou alergias",
      "Necessidade de plano para treinos",
      "Acompanhamento de doenças crônicas",
    ],
    fromPrice: 69,
  },
];

const EspecialidadeDetalhe = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const specialty = useMemo<SpecialtyContent | null>(() => {
    if (!slug) return null;
    return (
      SPECIALTIES_DATA.find((s) => s.slug === slug) ??
      SPECIALTIES_DATA.find((s) => slugify(s.name) === slug) ??
      null
    );
  }, [slug]);

  if (!specialty) {
    return (
      <div className="relative min-h-screen bg-background">
        <SEOHead
          title="Especialidade não encontrada - AloClínica"
          description="A especialidade que você procura não foi encontrada. Veja todas as especialidades disponíveis."
        />
        <Header />
        <section className="pt-40 pb-20 px-4 text-center max-w-2xl mx-auto">
          <Stethoscope className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" weight="light" />
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-3">
            Especialidade não encontrada
          </h1>
          <p className="text-muted-foreground mb-6">
            Não localizamos essa especialidade. Veja todas as opções disponíveis.
          </p>
          <Button onClick={() => navigate("/especialidades")} size="lg">
            Ver todas as especialidades
          </Button>
        </section>
      </div>
    );
  }

  const img = specialty.image || pingoFallback;

  return (
    <div className="relative min-h-screen bg-background">
      <SEOHead
        title={`${specialty.name} Online | AloClínica`}
        description={`${specialty.shortDesc} Agende uma teleconsulta com médicos especialistas em ${specialty.name.toLowerCase()} a partir de R$ ${specialty.fromPrice}.`}
        canonical={`https://aloclinica.com.br/especialidades/${specialty.slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "MedicalWebPage",
          name: `${specialty.name} Online — AloClínica`,
          url: `https://aloclinica.com.br/especialidades/${specialty.slug}`,
          description: specialty.shortDesc,
          about: {
            "@type": "MedicalSpecialty",
            name: specialty.name,
          },
          mainEntity: {
            "@type": "MedicalProcedure",
            name: `Teleconsulta em ${specialty.name}`,
            procedureType: "https://schema.org/NoninvasiveProcedure",
            offers: {
              "@type": "Offer",
              price: specialty.fromPrice,
              priceCurrency: "BRL",
              availability: "https://schema.org/InStock",
              url: `https://aloclinica.com.br/especialidades/${specialty.slug}`,
            },
          },
        }}
      />

      <Header />

      {/* Hero */}
      <section className="pt-32 pb-12 md:pt-40 md:pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate("/especialidades")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-6"
          >
            <CaretLeft className="w-4 h-4" weight="bold" />
            Todas as especialidades
          </button>

          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-4 py-1.5 rounded-full mb-5">
                <Stethoscope className="w-3.5 h-3.5" weight="fill" />
                Teleconsulta Especializada
              </span>
              <h1 className="text-3xl md:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
                {specialty.name} <span className="text-gradient">online</span>
              </h1>
              <p className="text-base md:text-lg text-muted-foreground mb-6 leading-relaxed">
                {specialty.shortDesc}
              </p>

              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Stethoscope className="w-5 h-5 text-primary" weight="fill" />
                  <span className="text-foreground">Médicos verificados disponíveis</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-5 h-5 text-emerald-600" weight="fill" />
                  <span className="text-foreground">Consultas hoje</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => navigate("/agendar")} size="lg" className="font-bold">
                  Agendar a partir de R$ {specialty.fromPrice}
                  <ArrowRight className="w-5 h-5 ml-2" weight="bold" />
                </Button>
                <Button
                  onClick={() => navigate("/como-funciona")}
                  variant="outline"
                  size="lg"
                  className="font-bold"
                >
                  Como funciona
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative flex justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-secondary/15 blur-3xl" />
              <img
                src={img}
                alt={`Pingo, mascote da AloClínica, vestido como ${specialty.name.toLowerCase()}`}
                className="relative w-full max-w-md object-contain drop-shadow-2xl"
                loading="eager"
                decoding="async"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Sobre */}
      <section className="py-12 md:py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-4 tracking-tight">
            Sobre a {specialty.name}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            {specialty.longDesc}
          </p>
        </div>
      </section>

      {/* Tratamentos + Quando procurar */}
      <section className="py-10 md:py-16 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-card rounded-3xl border border-border/40 p-6 md:p-8">
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-5 flex items-center gap-2">
              <Stethoscope className="w-6 h-6 text-primary" weight="fill" />
              O que tratamos
            </h3>
            <ul className="space-y-3">
              {specialty.treats.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm md:text-base text-foreground">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" weight="fill" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card rounded-3xl border border-border/40 p-6 md:p-8">
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-5 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" weight="fill" />
              Quando buscar ajuda
            </h3>
            <ul className="space-y-3">
              {specialty.whenToSeek.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm md:text-base text-foreground">
                  <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" weight="fill" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="py-12 md:py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-8 text-center tracking-tight">
            Sua consulta em 3 passos
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Stethoscope, title: "Escolha seu médico", desc: "Veja perfis, avaliações e horários disponíveis." },
              { icon: VideoCamera, title: "Faça a teleconsulta", desc: "Atendimento por vídeo, seguro e privado." },
              { icon: Prescription, title: "Receba sua receita", desc: "Receita digital com validade legal direto no app." },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-card rounded-2xl border border-border/40 p-6 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto mb-4 flex items-center justify-center">
                  <step.icon className="w-7 h-7" weight="fill" />
                </div>
                <h4 className="text-base font-bold text-foreground mb-1">{step.title}</h4>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="section-band band-plain">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-8 md:p-14 text-center overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,white_0%,transparent_60%)] opacity-10" />
          <div className="relative">
            <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-3 tracking-tight">
              Pronto para cuidar da sua saúde?
            </h2>
            <p className="text-white/85 mb-6 max-w-xl mx-auto">
              Médicos especialistas em {specialty.name} disponíveis hoje, a partir de R$ {specialty.fromPrice}.
            </p>
            <Button
              onClick={() => navigate("/agendar")}
              size="lg"
              variant="secondary"
              className="font-bold"
            >
              Agendar consulta
              <ArrowRight className="w-5 h-5 ml-2" weight="bold" />
            </Button>
            <p className="mt-4 text-xs text-white/70">
              Veja também{" "}
              <Link to="/especialidades" className="underline hover:text-white">
                outras especialidades
              </Link>
            </p>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default EspecialidadeDetalhe;
