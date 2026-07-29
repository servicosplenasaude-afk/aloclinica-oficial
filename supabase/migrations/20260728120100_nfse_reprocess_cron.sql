-- Reconciliação das NFS-e "processando": a emissão na Focus NFe é assíncrona, então
-- um job a cada 15 min re-invoca emit-nfse (idempotente por ref) para as notas que
-- ainda não ficaram "autorizado". Usa o mesmo helper das demais crons.
SELECT cron.schedule(
  'nfse-reprocess',
  '*/15 * * * *',
  $$SELECT public.invoke_edge_function('nfse-reprocess', '{}'::jsonb);$$
);
