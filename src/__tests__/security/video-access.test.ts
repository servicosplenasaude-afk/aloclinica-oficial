import { describe, expect, it } from "vitest";
import { expectedMirotalkRoom, isVideoAccessWindowOpen } from "../../../supabase/functions/_shared/video-access";

const start = Date.parse("2026-08-19T15:00:00.000Z");
const appointment = {
  status: "confirmed",
  scheduled_at: new Date(start).toISOString(),
  duration_minutes: 30,
  video_room_secret: "secret-123",
};

describe("video access policy", () => {
  it("allows only the bounded appointment window", () => {
    expect(isVideoAccessWindowOpen(appointment, start - 15 * 60_000)).toBe(true);
    expect(isVideoAccessWindowOpen(appointment, start - 15 * 60_000 - 1)).toBe(false);
    expect(isVideoAccessWindowOpen(appointment, start + 60 * 60_000)).toBe(true);
    expect(isVideoAccessWindowOpen(appointment, start + 60 * 60_000 + 1)).toBe(false);
  });

  it.each(["completed", "cancelled", "no_show"])("denies status %s", (status) => {
    expect(isVideoAccessWindowOpen({ ...appointment, status }, start)).toBe(false);
  });

  it("fails closed for invalid dates and missing room secrets", () => {
    expect(isVideoAccessWindowOpen({ ...appointment, scheduled_at: "invalid" }, start)).toBe(false);
    expect(expectedMirotalkRoom({ ...appointment, video_room_secret: null })).toBeNull();
    expect(expectedMirotalkRoom(appointment)).toBe("consulta-secret-123");
  });
});
