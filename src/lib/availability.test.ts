import { test, expect } from "bun:test";
import {
  DAYS,
  daysInRange,
  formatDayRange,
  formatExceptionWindow,
  formatRuleTime,
  formatRuleWindow,
  groupRulesByDaySet,
  isExceptionPast,
  ruleTimeToMinutes,
  upcomingExceptions,
} from "./availability";

test("daysInRange covers both ends", () => {
  expect(daysInRange(1, 1)).toEqual([1]);
  expect(daysInRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
  expect(daysInRange(0, 6)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(daysInRange(6, 6)).toEqual([6]);
});

test("daysInRange returns nothing for a backwards range", () => {
  expect(daysInRange(5, 1)).toEqual([]);
  expect(formatDayRange(daysInRange(5, 1))).toBe("");
});

test("daysInRange clamps out-of-bounds days", () => {
  expect(daysInRange(-3, 1)).toEqual([0, 1]);
  expect(daysInRange(5, 99)).toEqual([5, 6]);
  expect(daysInRange(Number.NaN, 2)).toEqual([0, 1, 2]);
  expect(daysInRange(1, Number.NaN)).toEqual([]);
});

test("formatDayRange names single days and ranges", () => {
  expect(formatDayRange([3])).toBe(DAYS[3]!);
  expect(formatDayRange([1, 2, 3, 4, 5])).toBe("Monday - Friday");
  expect(formatDayRange([5, 6, 0])).toBe("Friday - Sunday");
  expect(formatDayRange([1, 3, 5])).toBe("Monday, Wednesday, Friday");
  expect(formatDayRange([])).toBe("");
});

test("formatDayRange treats Saturday and Sunday as one weekend", () => {
  expect(formatDayRange([6, 0])).toBe("Saturday - Sunday");
  expect(formatDayRange([0, 6])).toBe("Saturday - Sunday");
});

/** Mon-Fri, 09:00-13:00 and 14:00-19:00 - ten rows in the database. */
const weekdayRules = [1, 2, 3, 4, 5].flatMap((day) => [
  { id: `m${day}`, dayOfWeek: day, startTime: "09:00", endTime: "13:00", isActive: true },
  { id: `a${day}`, dayOfWeek: day, startTime: "14:00", endTime: "19:00", isActive: true },
]);

test("groupRulesByDaySet collapses a Mon-Fri week into one entry with both windows", () => {
  const groups = groupRulesByDaySet(weekdayRules);

  expect(groups).toHaveLength(1);
  expect(groups[0]!.days).toEqual([1, 2, 3, 4, 5]);
  expect(formatDayRange(groups[0]!.days)).toBe("Monday - Friday");
  expect(groups[0]!.windows).toEqual([
    { startTime: "09:00", endTime: "13:00" },
    { startTime: "14:00", endTime: "19:00" },
  ]);
  expect(groups[0]!.ruleIds).toHaveLength(10);
});

test("groupRulesByDaySet orders the week Monday to Sunday", () => {
  const groups = groupRulesByDaySet([
    { id: "sun", dayOfWeek: 0, startTime: "09:00", endTime: "13:00" },
    { id: "sat", dayOfWeek: 6, startTime: "09:00", endTime: "13:00" },
    { id: "mon", dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
  ]);

  expect(groups.map((g) => formatDayRange(g.days))).toEqual([
    "Monday",
    "Saturday - Sunday",
  ]);
});

test("groupRulesByDaySet merges every day into a single all-week entry", () => {
  const groups = groupRulesByDaySet(
    [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      id: `r${d}`,
      dayOfWeek: d,
      startTime: "09:00",
      endTime: "13:00",
      isActive: true,
    })),
  );

  expect(groups).toHaveLength(1);
  expect(groups[0]!.days).toHaveLength(7);
  expect(formatDayRange(groups[0]!.days)).toBe("Monday - Sunday");
});

test("groupRulesByDaySet splits when a day has different windows", () => {
  const groups = groupRulesByDaySet([
    { id: "mon", dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
    { id: "tue", dayOfWeek: 2, startTime: "09:00", endTime: "13:00" },
    { id: "wed", dayOfWeek: 3, startTime: "09:00", endTime: "13:00" },
    { id: "wed2", dayOfWeek: 3, startTime: "14:00", endTime: "19:00" },
  ]);

  expect(groups.map((g) => formatDayRange(g.days))).toEqual([
    "Monday - Tuesday",
    "Wednesday",
  ]);
  expect(groups[1]!.windows).toHaveLength(2);
});

test("groupRulesByDaySet splits around a day with no rules", () => {
  const groups = groupRulesByDaySet([
    { id: "mon", dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
    { id: "tue", dayOfWeek: 2, startTime: "09:00", endTime: "13:00" },
    { id: "thu", dayOfWeek: 4, startTime: "09:00", endTime: "13:00" },
    { id: "fri", dayOfWeek: 5, startTime: "09:00", endTime: "13:00" },
  ]);

  expect(groups.map((g) => formatDayRange(g.days))).toEqual([
    "Monday - Tuesday",
    "Thursday - Friday",
  ]);
});

test("groupRulesByDaySet does not merge days with a different active flag", () => {
  const groups = groupRulesByDaySet([
    { id: "on", dayOfWeek: 1, startTime: "09:00", endTime: "13:00", isActive: true },
    { id: "off", dayOfWeek: 2, startTime: "09:00", endTime: "13:00", isActive: false },
  ]);

  expect(groups).toHaveLength(2);
  expect(groups[1]!.isActive).toBe(false);
});

test("groupRulesByDaySet treats missing isActive as active and sorts window rows", () => {
  const groups = groupRulesByDaySet([
    { id: "late", dayOfWeek: 1, startTime: "14:00", endTime: "19:00" },
    { id: "early", dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
  ]);

  expect(groups).toHaveLength(1);
  expect(groups[0]!.isActive).toBe(true);
  expect(groups[0]!.windows).toEqual([
    { startTime: "09:00", endTime: "13:00" },
    { startTime: "14:00", endTime: "19:00" },
  ]);
});

test("groupRulesByDaySet handles an empty list", () => {
  expect(groupRulesByDaySet([])).toEqual([]);
});

test("formatRuleTime passes through wall-clock values", () => {
  expect(formatRuleTime("09:00")).toBe("09:00");
  expect(formatRuleTime("09:00:00")).toBe("09:00");
  expect(formatRuleTime(null)).toBe("");
  expect(formatRuleTime(undefined)).toBe("");
});

test("formatRuleTime renders the API's ISO instant as a wall clock", () => {
  const iso = "1970-01-01T03:30:00.000Z";
  const date = new Date(iso);
  const expected = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;

  expect(formatRuleTime(iso)).toBe(expected);
  expect(formatRuleTime(iso)).toMatch(/^\d{2}:\d{2}$/);
});

test("formatRuleTime keeps unparseable values instead of showing NaN", () => {
  expect(formatRuleTime("not-a-time")).toBe("not-a-time");
});

test("formatRuleWindow formats both ends and tolerates a missing one", () => {
  expect(formatRuleWindow("1970-01-01T03:30:00.000Z", "1970-01-01T08:30:00.000Z")).toBe(
    formatRuleWindow("03:30", "08:30"),
  );
  expect(formatRuleWindow("09:00", null)).toBe("09:00");
  expect(formatRuleWindow(null, null)).toBe("");
});

test("formatExceptionWindow still labels a window-less exception as all day", () => {
  expect(formatExceptionWindow({ startTime: null, endTime: null })).toBe("All day");
  expect(formatExceptionWindow({ startTime: "09:00", endTime: "13:00" })).toBe("09:00 - 13:00");
});

/* ------------------------------------------------------------------ */
/*  Passed exceptions                                                   */
/* ------------------------------------------------------------------ */

const at = (iso: string) => new Date(iso);

test("ruleTimeToMinutes reads wall-clock and ISO values alike", () => {
  expect(ruleTimeToMinutes("09:30")).toBe(570);
  expect(ruleTimeToMinutes("00:00")).toBe(0);
  expect(ruleTimeToMinutes("23:59")).toBe(1439);
  expect(ruleTimeToMinutes(null)).toBeNull();
  expect(ruleTimeToMinutes("nope")).toBeNull();
  // Same convention as formatRuleTime: the ISO instant is read in local time.
  expect(ruleTimeToMinutes("1970-01-01T03:30:00.000Z")).toBe(
    (() => {
      const d = new Date("1970-01-01T03:30:00.000Z");
      return d.getHours() * 60 + d.getMinutes();
    })(),
  );
});

test("an exception on an earlier date has passed", () => {
  const now = at("2026-03-10T12:00:00");
  expect(isExceptionPast({ date: "2026-03-09", endTime: "23:59" }, now)).toBe(true);
  expect(isExceptionPast({ date: "2026-03-09" }, now)).toBe(true);
});

test("an exception on a later date has not passed", () => {
  const now = at("2026-03-10T12:00:00");
  expect(isExceptionPast({ date: "2026-03-11", startTime: "09:00", endTime: "13:00" }, now)).toBe(
    false,
  );
});

test("today's windowed exception is past once its end time is reached", () => {
  const now = at("2026-03-10T14:30:00");
  expect(isExceptionPast({ date: "2026-03-10", startTime: "14:00", endTime: "15:00" }, now)).toBe(
    false,
  );
  expect(isExceptionPast({ date: "2026-03-10", startTime: "09:00", endTime: "14:00" }, now)).toBe(
    true,
  );
  expect(isExceptionPast({ date: "2026-03-10", startTime: "14:30", endTime: "14:30" }, now)).toBe(
    true,
  );
});

test("today's all-day exception stays until the day is over", () => {
  expect(isExceptionPast({ date: "2026-03-10" }, at("2026-03-10T00:05:00"))).toBe(false);
  expect(isExceptionPast({ date: "2026-03-10" }, at("2026-03-10T23:30:00"))).toBe(false);
});

test("upcomingExceptions keeps only the future, sorted by date", () => {
  const now = at("2026-03-10T12:00:00");
  const kept = upcomingExceptions(
    [
      { id: "past", date: "2026-03-08" },
      { id: "later", date: "2026-03-14", endTime: "13:00" },
      { id: "today-later", date: "2026-03-10", endTime: "18:00" },
      { id: "today-done", date: "2026-03-10", endTime: "10:00" },
      { id: "tomorrow", date: "2026-03-11" },
    ],
    now,
  );

  expect(kept.map((e) => e.id)).toEqual(["today-later", "tomorrow", "later"]);
});

test("upcomingExceptions returns an empty list when everything has passed", () => {
  const now = at("2026-03-10T12:00:00");
  expect(upcomingExceptions([{ id: "a", date: "2026-01-01" }], now)).toEqual([]);
  expect(upcomingExceptions([], now)).toEqual([]);
});
