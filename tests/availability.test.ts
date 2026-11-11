import { describe, it, expect } from "vitest";
import { generateSlots } from "@/lib/availability";

// Wed Nov 18 2026 (UTC) — a fixed future date
const WED = new Date("2026-11-18T00:00:00.000Z");

type H = { dayOfWeek: number; startTime: string; endTime: string };

function h(dayOfWeek: number, startTime: string, endTime: string): H {
  return { dayOfWeek, startTime, endTime };
}

describe("generateSlots", () => {
  it("generates non-overlapping slots inside business hours", () => {
    const slots = generateSlots(WED, [h(3, "09:00", "12:00")], 60, []);
    expect(slots).toHaveLength(3);
    expect(slots[0].start.toISOString()).toBe("2026-11-18T09:00:00.000Z");
    expect(slots[0].end.toISOString()).toBe("2026-11-18T10:00:00.000Z");
    expect(slots[2].start.toISOString()).toBe("2026-11-18T11:00:00.000Z");
    expect(slots[2].end.toISOString()).toBe("2026-11-18T12:00:00.000Z");
  });

  it("does not create a slot when the remaining window is shorter than slot duration", () => {
    // 09:00–12:00 with 45-min slots → 09:00, 09:45, 10:30, 11:15 (11:15+45 > 12:00 excluded)
    const slots = generateSlots(WED, [h(3, "09:00", "12:00")], 45, []);
    expect(slots.map((s) => s.start.toISOString().slice(11, 16))).toEqual(["09:00", "09:45", "10:30", "11:15"]);
  });

  it("skips days without hours", () => {
    // WED is day 3; only Sunday has hours
    const slots = generateSlots(WED, [h(0, "09:00", "17:00")], 30, []);
    expect(slots).toHaveLength(0);
  });

  it("supports multiple windows in the same day", () => {
    const slots = generateSlots(WED, [h(3, "09:00", "10:00"), h(3, "14:00", "15:30")], 60, []);
    expect(slots.map((s) => s.start.toISOString().slice(11, 16))).toEqual(["09:00", "14:00"]);
  });

  it("excludes slots that collide with existing bookings, edge-to-edge is allowed", () => {
    const bookings = [
      // booked 10:00–11:00
      { startTime: new Date("2026-11-18T10:00:00.000Z"), endTime: new Date("2026-11-18T11:00:00.000Z") },
    ];
    // 30-min slots → 09:00 09:30 [10:00 x] [10:30 x] 11:00 11:30
    const slots = generateSlots(WED, [h(3, "09:00", "12:00")], 30, bookings);
    const starts = slots.map((s) => s.start.toISOString().slice(11, 16));
    expect(starts).toEqual(["09:00", "09:30", "11:00", "11:30"]);
  });

  it("excludes slots entirely in the past (no slots for a past date)", () => {
    const slots = generateSlots(new Date("2020-01-01T00:00:00.000Z"), [h(3, "09:00", "17:00")], 30, []);
    expect(slots).toHaveLength(0);
  });
});
