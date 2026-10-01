import { test, expect } from "bun:test";
import { bookingFocusHref, focusKeyFrom, resolveFocus, shouldDismissFocus } from "./booking-focus";

test("focusKeyFrom returns null without an id", () => {
  expect(focusKeyFrom(null, "123")).toBeNull();
  expect(focusKeyFrom(null, null)).toBeNull();
});

test("focusKeyFrom distinguishes repeat picks of the same id by nonce", () => {
  const first = focusKeyFrom("abc", "111");
  const second = focusKeyFrom("abc", "222");
  expect(first).not.toBe(second);
  // The same request is stable, so effects keyed on it do not re-run.
  expect(focusKeyFrom("abc", "111")).toBe(first);
});

test("a link without a nonce still produces a key", () => {
  // URLSearchParams.get returns null for an absent param, never undefined.
  expect(focusKeyFrom("abc", null)).toBe("abc|");
});

test("no id means nothing is focused or pinned", () => {
  expect(resolveFocus(null, ["a", "b"], false)).toEqual({
    focusId: null,
    visibleInList: false,
    pinned: false,
  });
});

test("a target present in the rendered list is highlighted in place", () => {
  expect(resolveFocus("b", ["a", "b", "c"], false)).toEqual({
    focusId: "b",
    visibleInList: true,
    pinned: false,
  });
});

test("a target outside the rendered page is pinned above it", () => {
  const state = resolveFocus("z", ["a", "b"], false);
  expect(state.visibleInList).toBe(false);
  expect(state.pinned).toBe(true);
});

test("nothing is pinned while the list is still loading", () => {
  // Prevents a pin flashing in and then being swapped for the real row.
  expect(resolveFocus("z", [], true).pinned).toBe(false);
  expect(resolveFocus("z", ["z"], true)).toEqual({
    focusId: "z",
    visibleInList: true,
    pinned: false,
  });
});

// --- regression: StrictMode double-invoked effects must not clear the focus ---
//
// A "skip the first run with a ref" guard was defeated by StrictMode, which
// double-invokes effects on mount. The second invocation looked like a real
// view change, so clearFocus() ran on every mount and the highlight never
// appeared for any deep link.

const view = { filter: "all", sort: "latest", page: 0, viewAs: "client" };

test("shouldDismissFocus keeps the focus when the view is unchanged", () => {
  // StrictMode runs the mount effect twice with identical values.
  expect(shouldDismissFocus(view, { ...view })).toBe(false);
  expect(shouldDismissFocus(view, { ...view })).toBe(false);
});

test("shouldDismissFocus drops the focus when the tab changes", () => {
  expect(shouldDismissFocus(view, { ...view, filter: "upcoming" })).toBe(true);
});

test("shouldDismissFocus drops the focus when the sort changes", () => {
  expect(shouldDismissFocus(view, { ...view, sort: "oldest" })).toBe(true);
});

test("shouldDismissFocus drops the focus when the page changes", () => {
  expect(shouldDismissFocus(view, { ...view, page: 1 })).toBe(true);
});

test("shouldDismissFocus drops the focus when the role view changes", () => {
  expect(shouldDismissFocus(view, { ...view, viewAs: "astrologer" })).toBe(true);
});

// --- deep links must always carry the nonce -------------------------------

test("bookingFocusHref builds a nonce-bearing focus link", () => {
  expect(bookingFocusHref("abc", 42)).toBe("/bookings?id=abc&t=42");
});

test("bookingFocusHref gives repeat clicks distinct URLs", () => {
  // Without the nonce both clicks produce the same URL and React Router treats
  // the second navigation as a no-op, so the card never re-highlights.
  expect(bookingFocusHref("abc", 1)).not.toBe(bookingFocusHref("abc", 2));
});

test("bookingFocusHref encodes ids that need escaping", () => {
  expect(bookingFocusHref("a b&c", 7)).toBe("/bookings?id=a%20b%26c&t=7");
});
