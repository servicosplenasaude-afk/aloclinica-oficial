# Ambiente sandbox da AloClínica

O sandbox é um ambiente isolado para homologar consultas, pagamentos, KYC, vídeo e fluxos clínicos com dados totalmente fictícios. Ele nunca deve acessar o projeto Supabase ou as credenciais de produção.

## Arquitetura

- Frontend: Cloudflare Pages, projeto `aloclinica-sandbox`.
- Domínio planejado: `sandbox.aloclinica.com.br`.
- Backend: projeto Supabase exclusivo do sandbox.
- Vídeo, pagamentos, e-mail, WhatsApp e KYC: endpoints sandbox ou destinatários controlados.
- Produção e sandbox devem usar contas, projetos, chaves, Storage e webhooks separados.

## Preparação local

1. Copie `.env.sandbox.example` para `.env.sandbox`.
2. Preencha o URL e a chave pública do Supabase de sandbox.
3. Execute `npm run build:sandbox`.
4. Valide localmente com `npm run preview`.

O build falha se as variáveis obrigatórias estiverem ausentes ou se o URL do Supabase for o projeto de produção conhecido.

## Cloudflare Pages

- Build command: `npm run build:sandbox`
- Build output: `dist`
- Production branch do projeto sandbox: `sandbox`
- Variáveis `VITE_*`: configurar no projeto Pages de sandbox.
- Proteger o domínio com Cloudflare Access antes de criar contas de teste.

O arquivo `wrangler.sandbox.jsonc` prepara o upload direto futuro, mas nenhum deploy deve ocorrer antes do Supabase isolado existir.

## Regras obrigatórias

- Exibir permanentemente o banner de homologação.
- Aplicar `noindex` e `nofollow`.
- Nunca copiar prontuários, documentos, imagens ou PII de produção.
- Usar contas `@teste` controladas e dados clínicos sintéticos.
- Desabilitar cobrança, mensagens e webhooks reais.
- Permitir seeds somente no sandbox, protegidos por `SEED_SECRET`.
- Limpar periodicamente consultas, arquivos e sessões de teste.
