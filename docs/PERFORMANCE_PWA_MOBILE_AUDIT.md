# Auditoria de performance, PWA e mobile

Data: 2026-08-19

## Escopo e medições

Dois builds de produção foram executados com `npm run build`. O baseline concluiu em 33,18 s, transformou 9.788 módulos e gerou 400 arquivos (44.677.422 bytes), 6.337.106 bytes de JavaScript e 392.155 bytes de CSS. O Workbox gerou 5 entradas de precache (3,18 KiB) e um `sw.js` de 2.739 bytes.

O build de validação concluiu com sucesso e manteve 5 entradas de precache (3,18 KiB). Durante a auditoria houve atualização concorrente das dependências e de outros arquivos do workspace (Vite PWA 1.2.0 -> 1.3.0 e 9.788 -> 9.857 módulos); por isso, tamanhos globais do segundo bundle não constituem comparação controlada com o baseline. A medição diretamente relacionada ao ajuste é determinística: o service worker passou de 3 rotas persistentes para Supabase para zero, e os três nomes de cache sensível deixaram de aparecer no `dist/sw.js`.

## Correções aplicadas

- Removido o runtime cache de `medical_records`, `prescriptions`, `profiles` e `appointments` (`StaleWhileRevalidate`, até 200 respostas/30 min).
- Removido o runtime cache geral da REST API Supabase (`NetworkFirst`, até 100 respostas/5 min).
- Removido o runtime cache do Storage Supabase (`CacheFirst`, até 100 respostas/7 dias), pois objetos privados podem conter documentos e exames.
- Adicionada limpeza pós-mount dos caches legados `supabase-medical-data`, `supabase-api` e `supabase-storage`, permitindo que clientes já instalados apaguem conteúdo persistido após receberem a versão nova.
- Mantidos apenas caches de fontes e imagens estáticas, além do precache mínimo de ícones/manifest/placeholder.

## Achados e recomendações não implementadas

1. **Carga inicial alta.** O HTML do baseline fazia preload de 12 chunks de vendor além do entrypoint e CSS. Entre eles estavam PDF (544,34 kB; 160,72 kB gzip), ícones (502,64 kB; 107,28 kB gzip), GSAP (114,38 kB; 45,33 kB gzip) e Markdown (77,41 kB; 22,38 kB gzip). Isso reduz parte do benefício do `React.lazy`; recomenda-se medir rotas com Lighthouse/WebPageTest e revisar `manualChunks` e imports compartilhados em uma tarefa dedicada.
2. **Assets muito grandes.** Nove PNGs ficam entre 1,65 MB e 2,52 MB; o logo principal tem 1,25 MB. Converter para AVIF/WebP responsivo e declarar dimensões tende a produzir o maior ganho de rede, mas altera o pipeline de conteúdo e não foi feito nesta mudança de baixo risco.
3. **CSS monolítico.** O baseline gerou um CSS de 392,15 kB (54,51 kB gzip). Vale auditar safelist/conteúdo do Tailwind e estilos globais.
4. **Lazy loading já é amplo.** Rotas públicas, dashboards e painéis pesados usam `React.lazy`; PDF também possui imports dinâmicos em fluxos relevantes. O problema mais visível é o grafo compartilhado/preload, não ausência geral de lazy loading.
5. **Manifest duplicado.** `public/manifest.json` diverge do manifest produzido pelo Vite PWA em atalhos, cores, orientação e nome. Atualmente o artefato efetivo do build é `manifest.webmanifest`; consolidar a fonte reduz drift.
6. **Dois service workers.** O PWA usa Workbox no escopo raiz e push usa `/push-sw.js` no escopo `/push/`; há rotina para remover registro push legado no escopo raiz. A separação atual evita disputa de escopo, mas merece teste de upgrade em navegador instalado.
7. **Capacitor/Android.** `webDir: dist`, schemes HTTPS e mixed content bloqueado estão adequados. O Android declara `android:allowBackup="true"`, ponto a revisar antes de produção para um app clínico; não foi alterado por estar fora do quick win estrito de build/PWA e exigir validação de política de backup/restauração.
8. **Cache HTTP.** `public/_headers` não define política explícita para assets com hash, HTML, manifest ou service worker. Recomenda-se `immutable` longo somente para `/assets/*` e `no-cache` para HTML, manifest e SW, validando paridade entre Cloudflare, nginx e Vercel.

## Validação

- `npm run build`: aprovado após a mudança.
- Inspeção do `dist/sw.js` gerado: nenhum match para `supabase-medical-data`, `supabase-api` ou `supabase-storage`.
- `npm run test -- --run src/test/pwa-offline.test.ts`: 3 testes aprovados.
- `git diff --check`: sem erros de whitespace nas mudanças (somente avisos de normalização LF/CRLF do workspace).
