# Auditoria de acessibilidade e UX clínica

Data: 2026-08-19
Escopo: inspeção estática dos fluxos principais e dos componentes compartilhados, com referência a WCAG 2.2 AA.

## Correções aplicadas

- Erros do `FormMessage` agora são regiões vivas (`role="alert"`) e continuam ligados ao campo por `aria-describedby`.
- `Input` e `Textarea` agora exibem estado inválido de forma consistente quando recebem `aria-invalid`.
- `Progress` normaliza valores entre 0 e 100 e expõe limites e valor via semântica Radix/ARIA.
- `Skeleton` e o placeholder visual de `OptimizedImage` foram removidos da árvore de acessibilidade.
- `EmptyState` anuncia estados comuns com educação e erros de modo assertivo; ícones de ação decorativos são ignorados.
- A regra que ocultava todos os scrollbars globalmente foi removida. As classes opt-in (`scrollbar-none`, `scrollbar-hide`) permanecem para áreas em que isso for deliberado.

## Achados maiores — requerem trabalho por fluxo

### P0 — segurança clínica

1. **Modais artesanais sem gerenciamento de foco.** Há overlays construídos com `div` em fluxos como `UrgentCareQueue`, `VideoRoom` e `FirstConsultationTour`. Alguns têm `role="dialog"`, mas não há garantia uniforme de foco inicial, contenção de Tab, Escape e retorno de foco. Migrar para `Dialog`/`AlertDialog` compartilhados e testar teclado e leitor de tela.
2. **Mensagens críticas dependem de toast.** Confirmar que falhas de triagem, pagamento, prescrição e conexão de vídeo também apareçam junto ao controle ou em região viva persistente; toast isolado pode desaparecer antes da leitura e não orienta a recuperação.

### P1 — formulários e teclado

1. **Rótulos não associados.** A varredura encontrou 57 ocorrências de `<label>` sem `htmlFor` (inclui alguns labels que envolvem o próprio campo). Priorizar autenticação, pré-consulta, prescrição, pagamento e cadastro; cada entrada deve ter nome acessível, instrução e erro associados.
2. **Controles não nativos.** Foram encontrados elementos clicáveis baseados em `div`, inclusive seleção de cartões e flip de carteira. Substituir ações por `button`; quando o elemento for realmente uma opção, usar radio/listbox conforme o padrão de interação.
3. **Validação e foco.** Ao submeter formulários clínicos, mover o foco para o resumo de erros ou primeiro campo inválido e manter o texto do erro específico e acionável. Não depender apenas de cor.
4. **Autocompletes clínicos.** Auditar `MedicalAutocomplete` e seletores de especialidade como combobox: setas, Enter, Escape, `aria-expanded`, `aria-controls` e opção ativa.

### P1 — leitores de tela e estrutura

1. Confirmar um único `h1` por rota e hierarquia de títulos sem saltos nos dashboards e etapas de atendimento.
2. Dar nomes acessíveis contextuais a botões de ícone repetidos (por exemplo, “Excluir notificação de consulta de 20/08”, não apenas “Excluir notificação”).
3. Em atualizações de fila, tempo de espera, conexão e gravação, usar uma região `status` estável e evitar anunciar cada atualização de relógio.
4. Tabelas administrativas e clínicas precisam de `caption`, cabeçalhos com `scope` e uma alternativa legível em telas estreitas quando forem usadas para dados de pacientes.

### P2 — contraste, zoom e movimento

1. Fazer medição automatizada e visual de contraste em todos os temas e papéis. Combinações com `text-muted-foreground/50`, texto de 10–12 px e cores hard-coded são candidatas a falhar 4,5:1.
2. Validar zoom a 200% e reflow a 320 CSS px, especialmente tabelas, vídeo, painéis laterais, pagamento e prescrição.
3. O projeto possui várias proteções para `prefers-reduced-motion`, mas novas animações devem ser testadas continuamente; estados clínicos não podem depender de animação.
4. Evitar texto essencial abaixo de 12 px e garantir alvos de pelo menos 24 × 24 CSS px (idealmente 44 × 44 em ações clínicas móveis).

## Roteiro de validação recomendado

1. Executar axe-core por rota nos papéis paciente, médico, clínica, recepção e admin.
2. Percorrer autenticação, agendamento, pré-consulta, consulta em vídeo, prescrição e pagamento somente com teclado.
3. Repetir os fluxos críticos com NVDA + Firefox/Chrome e VoiceOver + Safari.
4. Medir contraste nos temas claro/escuro, zoom 200%, reflow 320 px e preferências de movimento reduzido.
5. Adicionar testes de regressão para nome acessível, foco de modal, associação de erro e anúncios de status.

## Critérios de aceite

- Zero violações axe críticas/sérias nos fluxos clínicos principais.
- Nenhum bloqueio de teclado e foco sempre visível.
- Todos os campos têm nome, instrução e erro programaticamente associados.
- Modais contêm e devolvem foco; ações destrutivas exigem confirmação acessível.
- Texto normal atende 4,5:1 e texto grande/elementos gráficos essenciais atendem 3:1.
