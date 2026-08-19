export interface VideoAppointment {
  status: string;
  scheduled_at: string;
  duration_minutes?: number | null;
  patient_id?: string | null;
  doctor_id?: string | null;
  video_room_secret?: string | null;
}

export const VIDEO_EARLY_ENTRY_MS = 15 * 60_000;
export const VIDEO_LATE_GRACE_MS = 30 * 60_000;
export const VIDEO_ALLOWED_STATUSES = new Set(["scheduled", "confirmed", "in_progress"]);

export function isVideoAccessWindowOpen(appointment: VideoAppointment, nowMs = Date.now()): boolean {
  if (!VIDEO_ALLOWED_STATUSES.has(appointment.status)) return false;
  const startMs = Date.parse(appointment.scheduled_at);
  if (!Number.isFinite(startMs)) return false;
  const durationMs = Math.max(1, appointment.duration_minutes ?? 30) * 60_000;
  return nowMs >= startMs - VIDEO_EARLY_ENTRY_MS &&
    nowMs <= startMs + durationMs + VIDEO_LATE_GRACE_MS;
}

export function expectedMirotalkRoom(appointment: VideoAppointment): string | null {
  const secret = appointment.video_room_secret?.trim();
  return secret ? `consulta-${secret}` : null;
}
