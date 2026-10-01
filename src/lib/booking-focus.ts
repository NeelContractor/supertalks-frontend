/**
 * Focus target for a `/bookings?id=...` deep link.
 *
 * The navbar bell is a client-side link, so the interesting cases are all
 * "you are already on this page": only the query string changes, nothing about
 * the current filter/sort/page. The decision below is kept pure so it can be
 * reasoned about (and tested) without mounting the page.
 */

/**
 * Identity of the current focus request. Includes the `t` nonce so re-picking
 * the same session is a distinct request — the router ignores a navigation to
 * an identical URL, which would otherwise make a repeat click a no-op.
 */
export function focusKeyFrom(id: string | null, nonce: string | null): string | null {
  if (!id) return null;
  return `${id}|${nonce ?? ""}`;
}

/**
 * The one place that builds a `/bookings` focus deep link.
 *
 * The `t` nonce is what makes a repeat click work: React Router ignores a
 * navigation to a URL identical to the current one, so without it, re-picking
 * the same session from the bell while already on /bookings would be a no-op
 * and the card would never re-highlight. Every surface that links to a
 * specific session must go through here, otherwise it silently loses that.
 */
export function bookingFocusHref(id: string, nonce: number = Date.now()): string {
  return `/bookings?id=${encodeURIComponent(id)}&t=${nonce}`;
}

export interface FocusState {  /** The session to highlight, or null when the URL carries no target. */
  focusId: string | null;
  /** True when the row is part of the list currently rendered. */
  visibleInList: boolean;
  /**
   * True when the target exists but is *not* in the rendered list, so it has to
   * be pinned above it. The list only ever holds one page of one filter, while
   * the bell links the soonest upcoming session, which under the default
   * `latest` sort (newest start first) is usually on the last page.
   */
  pinned: boolean;
}

export function resolveFocus(
  id: string | null,
  renderedIds: readonly string[],
  loading: boolean,
): FocusState {
  if (!id) return { focusId: null, visibleInList: false, pinned: false };
  const visibleInList = renderedIds.includes(id);
  return {
    focusId: id,
    visibleInList,
    // Wait for the list to settle: deciding mid-load would pin a card for a
    // row that was about to render, then swap it out from under the user.
    pinned: !loading && !visibleInList,
  };
}

/** The list view a focus target belongs to. */
export interface ViewKey {
  filter: string;
  sort: string;
  page: number;
  viewAs: string;
}

/**
 * Whether moving from one list view to another should drop the current focus.
 *
 * This is deliberately a *comparison* rather than a "skip the first run" ref.
 * StrictMode double-invokes effects on mount, so a first-run guard reads the
 * second invocation as a real change and clears the focus on every mount --
 * which is exactly what silently broke deep-link highlighting. Comparing the
 * values makes an identical re-run a genuine no-op, while a genuine tab, sort,
 * page or role change still dismisses.
 */
export function shouldDismissFocus(prev: ViewKey, next: ViewKey): boolean {
  return (
    prev.filter !== next.filter ||
    prev.sort !== next.sort ||
    prev.page !== next.page ||
    prev.viewAs !== next.viewAs
  );
}
