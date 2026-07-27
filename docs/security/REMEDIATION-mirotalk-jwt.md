# Habilitar JWT no MiroTalk (defesa em profundidade do vídeo)

**Contexto.** O vetor principal já foi fechado: o nome da sala de vídeo agora é um
segredo aleatório por consulta (`appointments.video_room_secret`), imprevisível a
partir do `appointmentId`. O **JWT do MiroTalk** é uma camada extra: faz o próprio
servidor de vídeo exigir um token assinado para entrar na sala.

## Lado da APLICAÇÃO — já feito (no ar, com fallback seguro)
- Edge function **`mirotalk-token`**: pede um token ao MiroTalk (via `MIROTALK_API_KEY`)
  e o devolve ao front. Se o MiroTalk não estiver configurado, devolve `token: null`.
- `getJitsiUrl(room, name, token?)` anexa `?token=` quando há token.
- `JitsiRoom` busca o token (timeout de 2s) e entra COM token se houver, SEM token
  (comportamento atual) caso contrário. **Não quebra nem atrasa o vídeo** enquanto o
  servidor não estiver configurado — só passa a exigir token depois do passo abaixo.

## Lado do SERVIDOR — VOCÊ precisa fazer (container MiroTalk, no EasyPanel/VPS)
No serviço do MiroTalk (`meet.telemedicinaaloclinica.sbs`), definir as variáveis de
ambiente (usar os MESMOS valores já cadastrados nos secrets do Supabase, para casar):

```
JWT_KEY=<mesmo valor de MIROTALK_JWT_KEY>
API_KEY_SECRET=<mesmo valor de MIROTALK_API_KEY>
# Proteção que exige o token (nome exato varia com a versão do MiroTalk P2P):
HOST_PROTECTED=true
HOST_USER_AUTH=true
JWT_EXP=1h
```
Depois, **reiniciar** o container do MiroTalk. Confira no README/`.env.template` da
sua versão do MiroTalk P2P os nomes exatos das flags de proteção — versões diferem
(`HOST_PROTECTED`, `HOST_USER_AUTH`, `HOST_USERS`, `JWT_KEY`, `API_KEY_SECRET`).

## Ajuste do minter, se necessário
A `mirotalk-token` chama `POST {MIROTALK_URL}/api/v1/token` com header
`authorization: {API_KEY_SECRET}` e body `{ username, password, presenter, expire }`.
Se a sua versão do MiroTalk usar outro contrato (ex.: `/api/v1/join` devolvendo a URL
pronta, ou payload diferente), ajuste o corpo/endpoint em
`supabase/functions/mirotalk-token/index.ts` e redeploy.

## Como TESTAR (com 2 contas, uma consulta real que caia no MiroTalk)
1. Antes de ligar a proteção no servidor: abrir a URL da sala SEM token deve entrar
   (estado atual).
2. Ligar as variáveis + reiniciar o MiroTalk.
3. Abrir a URL da sala SEM token → deve ser **bloqueado**.
4. Entrar pela plataforma (que anexa `?token=`) → deve **entrar normalmente**.
   Se bloquear mesmo com token, o formato do token não bate com a versão → ajustar o
   minter (passo acima). Enquanto ajusta, desligue a proteção para não travar o vídeo.
