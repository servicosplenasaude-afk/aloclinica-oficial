/**
 * Dados institucionais de conformidade (CFM Resolução nº 2.314/2022, Art. 17).
 *
 * Fonte central única dos dados da Pessoa Jurídica e do Responsável Técnico
 * Médico exibidos publicamente (rodapé, página /responsavel-tecnico, documentos).
 *
 * Os valores abaixo refletem os dados reais já divulgados na página
 * /responsavel-tecnico. Substitua por placeholders "[PREENCHER ...]" apenas se
 * os dados oficiais ainda não estiverem disponíveis.
 */
export const COMPLIANCE = {
  razaoSocial: "ALO CLINICA MEDICA LTDA",
  cnpj: "66.474.468/0001-26",
  enderecoSede: "Boa Vista — Roraima, Brasil",
  foroComarca: "Comarca de Boa Vista, Estado de Roraima",
  diretorTecnicoMedico: "Dra. Tâmara Oliveira Vieira",
  diretorTecnicoCRM: "CRM 2352/RR",
  crmPessoaJuridica: "CRM-PJ nº 680/RR",
  contatoTecnico: "rt@aloclinica.com.br",

  // Identidade pública / contato (fonte única para termos e rodapé)
  dominio: "aloclinica.com.br",
  site: "https://aloclinica.com.br",
  emailContato: "contato@aloclinica.com.br",
  emailDpo: "dpo@aloclinica.com.br",
  emailSuporte: "suporte@aloclinica.com.br",
  emailMedicos: "medicos@aloclinica.com.br",
  // WhatsApp/telefone de suporte — PREENCHER com o número real (só dígitos, com
  // DDI+DDD, ex.: "5595912345678"). Enquanto vazio, os botões de "falar no
  // WhatsApp" caem para o e-mail de suporte (real) em vez de um número falso.
  whatsappSuporte: "",
  telefoneSuporte: "",

  // Fornecedores (subprocessadores)
  provedorPagamento: "Mercado Pago",
  provedorInfra: "Supabase",

  // Versão/última atualização dos documentos legais
  ultimaAtualizacaoLegal: "Julho de 2026",
} as const;

export type ComplianceInfo = typeof COMPLIANCE;

/**
 * URL de contato de suporte, honesta: usa o WhatsApp real se configurado
 * (COMPLIANCE.whatsappSuporte); senão cai para o e-mail de suporte (que existe).
 * Evita mandar o usuário para um wa.me com número falso (dead-end).
 */
export function supportContactUrl(text?: string): string {
  const wa = (COMPLIANCE.whatsappSuporte || "").replace(/\D/g, "");
  if (wa) return `https://wa.me/${wa}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  return `mailto:${COMPLIANCE.emailSuporte}${text ? `?body=${encodeURIComponent(text)}` : ""}`;
}
