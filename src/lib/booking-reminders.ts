import type { Booking } from "@/types";

/**
 * A session counts as "imminent" once it is within this window. The navbar
 * badge and the one-shot toast both key off it.
 */
export const REMINDER_LEAD_MINUTES = 15;
export const REMINDER_LEAD_MS = REMINDER_LEAD_MINUTES * 60_000;

const ALERTED_KEY = "bookingReminders";
/** Cap so the store cannot grow without bound over a long-lived account. */
const ALERTED_MAX = 200;

/** Start time as epoch ms, or NaN if the payload is malformed. */
export function startMs(booking: Pick<Booking, "startAt">): number {
  return Date.parse(booking.startAt);
}

/** Positive = still to come, negative = already started. */
export function msUntilStart(booking: Pick<Booking, "startAt">, now: number): number {
  return startMs(booking) - now;
}

/**
 * The soonest sessions that have already entered the reminder window. Rows that
 * have not started yet are the only ones we ever surface, so a stale poll that
 * arrives just after a start time still cannot show a session as upcoming.
 */
export function imminentBookings(bookings: Booking[], now: number): Booking[] {
  return bookings.filter((b) => {
    const delta = msUntilStart(b, now);
    return delta > 0 && delta <= REMINDER_LEAD_MS;
  });
}

/** "in 45s" / "in 15 min" / "in 2h 5m" / "in 3d" / "now". */
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "now";
  const seconds = Math.floor(msRemaining / 1000);
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return remainder ? `in ${hours}h ${remainder}m` : `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

/**
 * Reminders already delivered, keyed per user *and* per dashboard side so
 * switching between the astrologer and customer view cannot suppress (or
 * replay) the other side's alerts.
 */
function alertedStoreKey(scope: string): string {
  return `${ALERTED_KEY}:${scope}`;
}

export function loadAlerted(scope: string): Set<string> {
  try {
    const raw = localStorage.getItem(alertedStoreKey(scope));
    if (!raw) return new Set<string>();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set<string>();
  }
}

export function saveAlerted(scope: string, ids: Iterable<string>): void {
  try {
    const all = Array.from(ids);
    localStorage.setItem(alertedStoreKey(scope), JSON.stringify(all.slice(-ALERTED_MAX)));
  } catch {
    // Private-mode / quota failures must not break the reminder itself.
  }
}
