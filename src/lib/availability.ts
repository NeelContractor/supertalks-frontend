// Shared vocabulary for the weekly rules / date exceptions screens. Both the
// read-only profile overview and the edit dialog render the same lists and
// handle the same conflict responses, so the day names, the conflict shapes and
// the error-code reader live here rather than in either component.

import { ApiError } from "@/lib/api";

export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface RuleClash {
  ruleId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ExceptionClash {
  exceptionId: string;
  date: string;
  isBlocked: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

/**
 * A conflict the astrologer has to arbitrate: the summary explains the overlap
 * and `onResolve` re-runs the failed write with the resolution flag that keeps
 * the weekly rules instead of the exceptions (or the other way round).
 */
export type ClashDialog =
  | { kind: "rule"; conflicts: RuleClash[]; summary: string; onResolve: () => Promise<void> }
  | {
      kind: "exception";
      conflicts: ExceptionClash[];
      summary: string;
      onResolve: () => Promise<void>;
    }
  | null;

export interface ClashInfo {
  code: string;
  data: Record<string, unknown>;
  message: string;
}

/**
 * The availability endpoints answer a clash with a machine-readable `code`
 * instead of a plain error, so the caller can branch on it. Anything else is a
 * genuine failure and returns null.
 */
export function readClash(err: unknown): ClashInfo | null {
  if (!(err instanceof ApiError)) return null;
  const data = (err.data ?? {}) as Record<string, unknown>;
  const code = typeof data.code === "string" ? data.code : "";
  return code ? { code, data, message: err.message } : null;
}

/**
 * The API returns `@db.Time` columns as a full ISO instant
 * ("1970-01-01T03:30:00.000Z"), which is unreadable in a schedule. Render the
 * wall clock in the viewer's timezone - the same conversion a client sees on
 * the booking slots, so the profile and the bookable slots agree.
 * Values that are already "HH:mm" pass through untouched.
 */
export function formatRuleTime(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** "09:00 - 13:00" for a rule or window. */
export function formatRuleWindow(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string {
  const start = formatRuleTime(startTime);
  const end = formatRuleTime(endTime);
  return start && end ? `${start} - ${end}` : start || end;
}

/** Exceptions without a window are all-day, which is how they are labelled. */
export function formatExceptionWindow(e: { startTime?: string | null; endTime?: string | null }) {
  return e.startTime && e.endTime ? formatRuleWindow(e.startTime, e.endTime) : "All day";
}

/* ------------------------------------------------------------------ */
/*  Has this exception happened yet?                                     */
/* ------------------------------------------------------------------ */

/** Minutes since midnight for "HH:mm" or an API ISO instant, else null. */
export function ruleTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(formatRuleTime(value));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Today as YYYY-MM-DD in the viewer's timezone. */
function localDateKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export interface ExceptionLike {
  /** YYYY-MM-DD */
  date: string;
  startTime?: string | null;
  endTime?: string | null;
}

/**
 * True once the exception's date (and window, if it has one) is behind us.
 *
 * A window-less exception covers the whole day, so it only counts as past on a
 * later date. A windowed one is past as soon as its end time is reached, which
 * is what lets an adjusted slot disappear from the profile the moment it has
 * run.
 */
export function isExceptionPast(exception: ExceptionLike, now: Date = new Date()): boolean {
  const today = localDateKey(now);
  if (exception.date < today) return true;
  if (exception.date > today) return false;

  const endMinutes = ruleTimeToMinutes(exception.endTime) ?? 24 * 60;
  return endMinutes <= now.getHours() * 60 + now.getMinutes();
}

/** Drops the exceptions that have already happened, keeping the rest in order. */
export function upcomingExceptions<T extends ExceptionLike>(
  exceptions: T[],
  now: Date = new Date(),
): T[] {
  return exceptions
    .filter((e) => !isExceptionPast(e, now))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ */
/*  Day ranges                                                         */
/* ------------------------------------------------------------------ */

/**
 * Every day from `fromDay` through `toDay` inclusive (0 = Sunday). Ranges never
 * wrap the week: "Friday to Monday" is rejected rather than silently becoming
 * Fri/Sat/Sun/Mon, because a weekly schedule that wraps is ambiguous to read.
 */
export function daysInRange(fromDay: number, toDay: number): number[] {
  const from = clampDay(fromDay);
  const to = clampDay(toDay);
  if (to < from) return [];
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function clampDay(day: number): number {
  if (!Number.isFinite(day)) return 0;
  return Math.min(Math.max(Math.floor(day), 0), DAYS.length - 1);
}

/** Monday-first ordering, so a Sat/Sun weekend reads as one block. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** True when `b` is the day right after `a`, treating Saturday -> Sunday as consecutive. */
function isNextDay(a: number, b: number): boolean {
  return (a + 1) % DAYS.length === b;
}

/** Days sorted Monday-first, so grouping and labels agree on the week order. */
function sortWeekDays(days: number[]): number[] {
  return [...days].sort(
    (a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b),
  );
}

/** "Mon - Fri", or the single day name when the range covers one day. */
export function formatDayRange(days: number[]): string {
  if (days.length === 0) return "";
  const sorted = sortWeekDays(days);
  if (sorted.length === 1) return DAYS[sorted[0]!] ?? "";

  const contiguous = sorted.every((d, i) => i === 0 || isNextDay(sorted[i - 1]!, d));
  if (!contiguous) return sorted.map((d) => DAYS[d] ?? "").join(", ");
  return `${DAYS[sorted[0]!]} - ${DAYS[sorted[sorted.length - 1]!]}`;
}

export interface RuleLike {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

export interface RuleWindow {
  startTime: string;
  endTime: string;
}

/**
 * One entry per set of days, carrying every window that applies to them.
 *
 * Rules are stored one row per day, so "Monday to Friday, 9-1 and 2-7" arrives as
 * ten rows. Grouping by the day set that shares the same windows turns it into
 * the single entry the astrologer actually set: `Monday - Friday` with both
 * windows listed. A day breaks the run when it is missing (Sat/Sun) or has a
 * different set of windows.
 */
export interface RuleGroup {
  key: string;
  days: number[];
  windows: RuleWindow[];
  isActive: boolean;
  ruleIds: string[];
}

export function groupRulesByDaySet(rules: RuleLike[]): RuleGroup[] {
  const byDay = new Map<number, RuleLike[]>();
  for (const rule of rules) {
    const list = byDay.get(rule.dayOfWeek) ?? [];
    list.push(rule);
    byDay.set(rule.dayOfWeek, list);
  }

  const signature = (dayRules: RuleLike[]) =>
    dayRules
      .map((r) => `${r.startTime}-${r.endTime}-${r.isActive ?? true}`)
      .sort()
      .join("|");

  const groups: RuleGroup[] = [];
  let previous: { day: number; signature: string } | null = null;

  for (const day of sortWeekDays([...byDay.keys()])) {
    const dayRules = (byDay.get(day) ?? []).sort((a, b) =>
      `${a.startTime}${a.endTime}`.localeCompare(`${b.startTime}${b.endTime}`),
    );
    const sig = signature(dayRules);
    const windows = dayRules.map((r) => ({ startTime: r.startTime, endTime: r.endTime }));
    const isActive = (dayRules[0]?.isActive ?? true) && dayRules.every((r) => r.isActive ?? true);

    const last = groups[groups.length - 1];
    const continues =
      previous !== null &&
      previous.signature === sig &&
      last !== undefined &&
      isNextDay(previous.day, day);

    if (continues && last) {
      last.days.push(day);
      last.ruleIds.push(...dayRules.map((r) => r.id));
      previous = { day, signature: sig };
      continue;
    }

    groups.push({
      key: `${day}-${sig}`,
      days: [day],
      windows,
      isActive,
      ruleIds: dayRules.map((r) => r.id),
    });
    previous = { day, signature: sig };
  }

  return groups;
}

/** Stable key fragment: the group index, since a day's position is enough here. */
function daysKeySoFar(groups: RuleGroup[], day: number): string {
  return `${groups.length}-${day}`;
}