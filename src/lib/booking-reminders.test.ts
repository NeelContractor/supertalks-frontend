import { test, expect } from "bun:test";
import {
  REMINDER_LEAD_MS,
  formatCountdown,
  imminentBookings,
  msUntilStart,
} from "./booking-reminders";
import type { Booking } from "@/types";

const NOW = Date.parse("2026-03-01T10:00:00.000Z");

function booking(overrides: Partial<Booking> & { id: string }): Booking {
  return {
    clientId: "c1",
    astrologerId: "a1",
    startAt: new Date(NOW + 60_000).toISOString(),
    endAt: new Date(NOW + 120_000).toISOString(),
    status: "Confirmed",
    pricePaise: 1000,
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    ...overrides,
  } as Booking;
}

test("formatCountdown covers sub-minute through multi-day", () => {
  expect(formatCountdown(0)).toBe("now");
  expect(formatCountdown(-5_000)).toBe("now");
  expect(formatCountdown(45_000)).toBe("in 45s");
  expect(formatCountdown(15 * 60_000)).toBe("in 15 min");
  expect(formatCountdown(2 * 3_600_000 + 5 * 60_000)).toBe("in 2h 5m");
  expect(formatCountdown(3 * 3_600_000)).toBe("in 3h");
  expect(formatCountdown(50 * 3_600_000)).toBe("in 2d");
});

test("imminentBookings only returns unstarted sessions inside the lead window", () => {
  const list = [
    booking({ id: "far", startAt: new Date(NOW + 3 * 3_600_000).toISOString() }),
    booking({ id: "edge-in", startAt: new Date(NOW + REMINDER_LEAD_MS).toISOString() }),
    booking({ id: "mid", startAt: new Date(NOW + 5 * 60_000).toISOString() }),
    booking({ id: "past", startAt: new Date(NOW - 1_000).toISOString() }),
  ];
  expect(imminentBookings(list, NOW).map((b) => b.id)).toEqual(["edge-in", "mid"]);
});

test("a session drops out of the imminent set the moment it starts", () => {
  const list = [booking({ id: "b", startAt: new Date(NOW + 30_000).toISOString() })];
  expect(imminentBookings(list, NOW)).toHaveLength(1);
  expect(imminentBookings(list, NOW + 30_001)).toHaveLength(0);
});

test("msUntilStart is positive before and negative after the start", () => {
  const b = booking({ id: "b", startAt: new Date(NOW + 10_000).toISOString() });
  expect(msUntilStart(b, NOW)).toBe(10_000);
  expect(msUntilStart(b, NOW + 20_000)).toBe(-10_000);
});

test("malformed startAt is never treated as imminent", () => {
  const bad = booking({ id: "bad", startAt: "not-a-date" });
  expect(Number.isNaN(msUntilStart(bad, NOW))).toBe(true);
  expect(imminentBookings([bad], NOW)).toHaveLength(0);
});
