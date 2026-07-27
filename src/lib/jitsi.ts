/**
 * MiroTalk P2P integration for AloClínica teleconsultation.
 * Self-hosted on https://meet.telemedicinaaloclinica.sbs (substitui Jitsi).
 */

export const JITSI_BASE_URL = "https://meet.telemedicinaaloclinica.sbs";

export function gerarRoomId(appointmentId: string): string {
  return `consulta-${appointmentId}`;
}

export function getJitsiUrl(roomId: string, displayName: string, token?: string | null): string {
  const params = new URLSearchParams({
    name: displayName,
    audio: "1",
    video: "1",
    screen: "0",
    notify: "0",
    hide: "0",
  });
  // JWT do MiroTalk (defesa em profundidade). Só é exigido se o servidor MiroTalk
  // estiver com proteção JWT ligada; caso contrário é ignorado.
  if (token) params.set("token", token);
  return `${JITSI_BASE_URL}/join/${encodeURIComponent(roomId)}?${params.toString()}`;
}
