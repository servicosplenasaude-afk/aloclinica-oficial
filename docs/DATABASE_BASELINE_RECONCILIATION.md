# Reconciliação do baseline do banco de produção

## Estado comprovado em 25/08/2026

- Projeto de produção: `pwxvvimdtmvziynbspgx`.
- Histórico local: 314 versões que não constam na produção.
- Histórico remoto: 66 versões que nunca existiram no Git deste repositório.
- Versões coincidentes: zero.
- Esquema remoto `public`: 153 tabelas, 145 funções, 6 views, 337 políticas,
  174 índices e 13 tipos.
- Evidência: workflow `Database Safety Checks`, execução `32794249252`.
- O dump é somente esquema, sem linhas, e o artefato publicado é redigido.

Isso caracteriza duas linhagens independentes. Não é seguro executar as migrations
locais em produção nem marcar todas como aplicadas sem comparar o resultado.

## Procedimento seguro

1. Criar um projeto Supabase temporário e isolado, sem webhooks ou integrações.
2. Restaurar nele o esquema redigido, substituindo o marcador `JWT_ANON` por uma
   chave pública própria do projeto temporário.
3. Gerar um snapshot estrutural do projeto e executar testes de RLS, funções e
   fluxos clínicos usando apenas dados fictícios.
4. Aplicar as 314 migrations locais nesse ambiente, uma por vez, registrando para
   cada versão: aplicada, já presente/equivalente ou incompatível.
5. Produzir uma migration consolidada apenas com diferenças desejadas e idempotentes.
6. Confirmar backup/PITR de produção e ensaiar a migration consolidada em uma cópia.
7. Somente após aprovação, aplicar a consolidada em produção.
8. Arquivar a linhagem antiga e adotar um novo baseline reproduzível. Qualquer
   `migration repair` deve ser manual, versionado e posterior ao ensaio.

## Condições de bloqueio

- Nenhuma operação destrutiva ou `migration repair` automática.
- Nenhum dump com dados pessoais em artefatos de CI.
- Nenhuma migration local aplicada diretamente enquanto a divergência existir.
- O workflow deve continuar vermelho até o ensaio produzir equivalência comprovada.

## Próxima autoridade externa necessária

É necessário criar um projeto Supabase temporário na conta correta ou conceder uma
credencial capaz de criá-lo. O projeto deve ser descartável e não pode compartilhar
webhooks, chaves ou dados com produção.
