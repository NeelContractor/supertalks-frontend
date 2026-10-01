// Client-bundled code: never touch `process` directly (not defined in the browser).
// Bun statically inlines env vars accessed through this object at build time.
const env =
  typeof process !== "undefined" && typeof process.env === "object" ? process.env : {};

/** Origin of the astrologer's public website (the themed public site). */
export const SITE_ORIGIN = env.SITE_ORIGIN_URL ?? "http://localhost:3002";

/** Public page URL for an astrologer profile, or null when no slug exists. */
export function astrologerSiteUrl(slug?: string | null): string | null {
  if (!slug) return null;
  return `${SITE_ORIGIN}/${slug}`;
}