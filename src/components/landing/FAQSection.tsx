import { useEffect, useState, forwardRef } from "react";
import { db } from "@/integrations/supabase/untyped";
import { motion, AnimatePresence } from "framer-motion";
import { ChatCircleDots, Plus, Sparkle, ArrowRight } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

type FaqEntry = { q: string; a: string; category: string };

const staticFaqs: FaqEntry[] = [
  { q: "A consulta por vídeo tem a mesma validade de uma presencial?", a: "Sim! A telemedicina é regulamentada pelo CFM e as consultas realizadas pela AloClinica têm a mesma validade legal de uma consulta presencial, incluindo receitas e atestados.", category: "consulta" },
  { q: "Como funciona a receita digital?", a: "Após a consulta, o médico emite uma receita digital assinada eletronicamente. Você recebe o PDF pelo aplicativo e pode apresentá-la em qualquer farmácia.", category: "receita" },
  { q: "Posso cancelar meu plano a qualquer momento?", a: "Sim, você pode cancelar seu plano mensal a qualquer momento sem multa. O acesso continua até o fim do período pago.", category: "plano" },
  { q: "Os dados da minha consulta são sigilosos?", a: "Absolutamente. Todas as consultas são protegidas com criptografia end-to-end e seguimos rigorosamente a LGPD e as normas do CFM para sigilo médico.", category: "segurança" },
  { q: "Quais especialidades estão disponíveis?", a: "Contamos com mais de 30 especialidades, incluindo Cardiologia, Pediatria, Dermatologia, Ortopedia, Clínico Geral e muitas outras.", category: "consulta" },
];

const FAQSection = forwardRef<HTMLElement>((_, ref) => {
  const navigate = useNavigate();
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<FaqEntry[]>(staticFaqs);

  useEffect(() => {
    (db as any).rpc("get_public_faq_items", { p_limit: 5 })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setFaqs(data.map((d) => ({ q: d.question, a: d.answer, category: d.category ?? "geral" })));
        }
      });
  }, []);

  const visible = faqs.slice(0, 5);

  useEffect(() => {
    if (faqs.length === 0) return;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    document.getElementById("faq-jsonld")?.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    script.id = "faq-jsonld";
    document.head.appendChild(script);
    return () => { document.getElementById("faq-jsonld")?.remove(); };
  }, [faqs]);

  return (
    <section id="faq" ref={ref} className="section-band band-plain band-divider" aria-labelledby="faq-heading">
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-[hsl(var(--pingo-ice)/0.35)] blur-3xl pointer-events-none" />
      <div className="section-inner max-w-3xl">
        {/* Header compacto */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10"
        >
          <div className="section-eyebrow mb-4">
            <Sparkle className="w-3.5 h-3.5" weight="fill" />
            Dúvidas frequentes
          </div>
          <h2 id="faq-heading" className="section-title text-foreground">
            Perguntas <span className="text-gradient-pingo">frequentes</span>
          </h2>
        </motion.div>

        {/* Accordion compacto */}
        <div className="space-y-2">
          {visible.map((faq, i) => {
            const isOpen = openItem === faq.q;
            return (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={`rounded-2xl border transition-all duration-400 overflow-hidden ${
                  isOpen
                    ? "bg-[linear-gradient(135deg,hsl(var(--pingo-ice)/0.35),hsl(var(--pingo-mint)/0.10))] border-[hsl(var(--pingo-sky)/0.4)] shadow-[0_18px_45px_-24px_hsl(var(--pingo-blue)/0.55)]"
                    : "bg-card/70 border-border/60 hover:border-[hsl(var(--pingo-sky)/0.35)] hover:bg-card"
                }`}
              >
                <button
                  onClick={() => setOpenItem(isOpen ? null : faq.q)}
                  className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left"
                >
                  <span className="flex-1 font-display text-[15px] font-bold text-foreground/90 leading-snug">
                    {faq.q}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.25 }}
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      isOpen
                        ? "bg-[linear-gradient(135deg,hsl(var(--pingo-blue)),hsl(var(--pingo-mint)))] text-white shadow-[0_8px_20px_-8px_hsl(var(--pingo-blue)/0.7)]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Plus weight="bold" style={{ width: 14, height: 14 }} />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-4 sm:px-5 pb-4 text-[14px] text-muted-foreground leading-relaxed">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* CTA enxuto */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-center"
        >
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <ChatCircleDots className="w-4 h-4 text-primary" weight="fill" />
            Ainda tem dúvidas?
          </p>
          <Button
            size="sm"
            onClick={() => navigate("/contato")}
            className="rounded-full px-5 font-bold"
          >
            Falar com suporte <ArrowRight className="w-4 h-4 ml-1" weight="bold" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
});
FAQSection.displayName = "FAQSection";
export default FAQSection;
