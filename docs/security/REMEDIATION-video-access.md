# Remediação — acesso à consulta em vídeo (HIGH, pré-lançamento)

**Risco:** um terceiro que saiba o `appointmentId` (vai no link `/dashboard/consultation/<id>`) pode entrar/espionar/atrapalhar a consulta ao vivo, porque os canais de sinalização são públicos e o nome da sala é derivado do `appointmentId`.

**⚠️ Aplicar com uma CONSULTA DE TESTE real** (paciente + médico conectando de fato). É o fluxo mais crítico e não dá para validar sem uma chamada real.

## Opção A (recomendada, mais simples) — nome de sala por segredo aleatório
Troca o identificador de sala/canal de `appointmentId` por um segredo por consulta, que só os participantes leem (RLS de `appointments` já protege a linha).

1. Coluna do segredo:
```sql
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS video_room_secret uuid NOT NULL DEFAULT gen_random_uuid();
```
2. `src/lib/jitsi.ts` — `gerarRoomId` passa a receber o segredo:
```ts
export function gerarRoomId(secret: string): string {
  return `consulta-${secret}`;
}
```
3. Em `VideoRoom.tsx` / `use-webrtc.ts`: carregar `appointments.video_room_secret` (o participante já lê a linha via RLS) e usar `secret` como `roomId` para (a) o canal WebRTC (`webrtc-${secret}`), (b) o nome da sala MiroTalk. Um terceiro com o `appointmentId` não deriva o segredo.

## Opção B (mais completa) — canais privados + RLS do Realtime
A política de `realtime.messages` já autoriza tópicos `appointment:<id>` só para participantes, mas **nenhum canal usa `private: true`** hoje (logo a proteção está inativa).

1. `use-webrtc.ts` (e `video-room-*`, `waiting-chat-*`): criar o canal como privado e no tópico esperado:
```ts
const channel = db.channel(`appointment:${appointmentId}`, {
  config: { private: true, broadcast: { self: false } },
});
```
2. Conferir a policy de INSERT/broadcast (`realtime.messages`, cmd 'a') — o `WITH CHECK` precisa autorizar o participante a publicar no tópico `appointment:<id>` (espelhar a policy de leitura). Se não autorizar, o envio quebra.

## MiroTalk (server-side, obrigatório nas duas opções)
Habilitar host-protection / JWT / senha por sala no MiroTalk self-hosted (`meet.telemedicinaaloclinica.sbs`) — hoje qualquer URL de sala é aberta. Ver a config do container (variáveis `HOST_PROTECTED`, `JWT_*` do MiroTalk).

## Verificação pós-fix
- Participante (paciente e médico) conecta normalmente numa consulta de teste.
- Um 3º usuário logado, com o `appointmentId`, NÃO consegue entrar no canal `webrtc`/sala e recebe negação.
