-- HIGH (acesso à consulta): a sala de vídeo (WebRTC + MiroTalk) e o canal de
-- sinalização eram identificados pelo appointmentId, que vai no link da consulta
-- (compartilhado por WhatsApp/notificação). Um terceiro que soubesse o appointmentId
-- podia derivar o nome da sala e entrar/espionar a consulta ao vivo.
--
-- Correção: cada consulta ganha um SEGREDO aleatório usado como identificador da
-- sala/canal. Ambos os participantes leem a mesma linha de appointments (RLS já
-- restringe a leitura ao paciente/médico/admin), portanto derivam o MESMO segredo;
-- um terceiro com o appointmentId não consegue o segredo → não deriva a sala.
-- O front cai no appointmentId se o segredo faltar (sem regressão).
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS video_room_secret uuid NOT NULL DEFAULT gen_random_uuid();
