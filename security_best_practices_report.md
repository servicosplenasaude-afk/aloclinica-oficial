# Auditoria de segurança — AloClínica

## Resumo executivo

A revisão de 24/08/2026 cobriu o frontend React/TypeScript, Edge Functions,
Cloudflare Pages, dependências e histórico Git. Foram corrigidos um sink HTML,
uma CSP excessivamente permissiva e quatro vulnerabilidades de dependências.
`npm audit --omit=dev` agora retorna zero vulnerabilidades e a auditoria interna
de produção retorna zero achados. Nenhuma credencial real foi impressa durante a
análise.

## Alto

### SEC-101 — Dependências com advisory alto e redirects vulneráveis — corrigido

- Local: `package.json:95`, `package.json:115` e `package.json:128`.
- Evidência: React Router 6 e Vite 5 resultavam em três advisories moderados e um
  alto no grafo de produção.
- Impacto: tratamento inseguro de redirects e componentes vulneráveis do
  toolchain.
- Correção: React Router `7.18.2`, Vite `8.2.2` e plugin React SWC `4.3.3`.
- Validação: TypeScript, build e 400 testes aprovados; `npm audit` com zero.
- Prevenção: Dependabot semanal e workflow `Dependency Security` bloqueiam novos
  advisories moderados/altos em alterações do manifesto ou lockfile.

## Médio

### SEC-102 — HTML e evento inline no fallback fatal — corrigido

- Local: `src/main.tsx:115-130`.
- Evidência: o fallback usava `root.innerHTML` e `onclick` em string.
- Impacto: mantinha um sink de HTML/código incompatível com uma CSP estrita.
- Correção: construção por `createElement`, `textContent`, `addEventListener` e
  `replaceChildren`, sem interpretar HTML.

### SEC-103 — CSP aceitava eval, HTTP e origens antigas — corrigido

- Local: `public/_headers:18`.
- Evidência: `unsafe-eval`, IPs HTTP, imagens HTTP, APIs server-side e origens de
  desenvolvimento estavam permitidos no app clínico.
- Impacto: maior superfície para execução de script, exfiltração e mixed content.
- Correção: removidos `unsafe-eval`, IPs HTTP, `cdn.gpteng`, APIs server-side e
  framing externo; `frame-ancestors` agora é somente `self`.

### SEC-104 — Histórico de migrations divergente — aberto

- Local: `.github/workflows/database-safety.yml:21-44` e Supabase remoto.
- Evidência: o gate encontrou 314 versões somente locais e 66 somente remotas.
- Impacto: um `db push` ou `migration repair` indiscriminado pode reaplicar ou
  marcar incorretamente mudanças de banco.
- Correção necessária: reconciliar por snapshot/diff em projeto isolado e aprovar
  cada versão; o workflow permanece fail-closed e não executa repair automático.

## Baixo / hardening residual

### SEC-105 — `unsafe-inline` ainda existe na CSP — aberto

- Local: `public/_headers:18`, `index.html:61` e `public/offline.html:62`.
- Evidência: JSON-LD e script offline continuam inline.
- Impacto: reduz a proteção da CSP contra XSS, embora `unsafe-eval` e sinks
  identificados já tenham sido removidos.
- Próximo passo: mover o script offline para arquivo externo e aplicar hash CSP
  estável ao JSON-LD antes de retirar `unsafe-inline`.

### SEC-106 — WAF e rotação externa não certificáveis — aberto

- Evidência: o token Cloudflare local está ativo, mas enxerga zero zones; as duas
  contas GitHub CLI possuem somente leitura administrativa e não acessam secrets.
- Impacto: não foi possível configurar WAF nem substituir credenciais em GitHub.
- Mitigação: nunca revogar primeiro. Criar token substituto com escopo mínimo,
  atualizar GitHub/Cloudflare/Supabase, validar deploy e somente então revogar o
  anterior.

## Histórico Git

A árvore atual não contém credencial real compatível com os padrões pesquisados.
O único padrão Cloudflare era dado fictício em teste e foi dividido em literais
para evitar falso positivo. O histórico contém referências documentais a
prefixos `sbp_`/`ghp_`, mas a busca por formato completo não encontrou valores
compatíveis com tokens reais. Reescrita destrutiva do histórico não foi executada
sem evidência de segredo real e sem janela coordenada para todos os clones.
