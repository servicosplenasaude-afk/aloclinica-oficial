import { defineTool } from "npm:@lovable.dev/mcp-js@0.20.1";

export default defineTool({
  name: "platform_info",
  title: "AloClínica platform info",
  description:
    "Return a short description of the AloClínica telemedicine platform: what it does, main features, and public URLs.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text" as const,
        text: [
          "AloClínica — plataforma brasileira de telemedicina.",
          "Serviços: agendamento de consultas online, plantão 24h, receitas digitais assinadas (ICP-Brasil), atestados e cartão de saúde digital.",
          "Site público: https://aloclinica.com.br",
          "Especialidades atendidas: use a ferramenta list_specialties.",
          "Diretório de médicos aprovados: use a ferramenta search_doctors.",
          "Conformidade: CFM 2.314/2022 e LGPD.",
        ].join("\n"),
      },
    ],
  }),
});
