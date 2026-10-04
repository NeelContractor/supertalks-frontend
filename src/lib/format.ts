// Amount formatting for the dashboard's headline figures.
//
// Indian short scale is what the audience reads: a lifetime-earnings tile
// showing "₹12345678" is unreadable at a glance, while "₹1.23Cr" is. Below a
// lakh the exact figure is kept, because there the full number still fits and
// rounding would throw away digits that matter.

const LAKH = 100_000;
const CRORE = 10_000_000;

/** Trims trailing zeros so 2.50Cr reads as 2.5Cr, not 2.50Cr. */
function trim(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** Exact number with Indian digit grouping: 1234567 -> "12,34,567". */
export function formatNumberIN(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** Exact rupees, e.g. paise 123456 -> "₹1,234.56". */
export function formatINR(paise: number): string {
  return `₹${formatNumberIN(paise / 100)}`;
}

/**
 * Short-scale rupees: paise 123450000 -> "₹1.23L", paise 2500000000 ->
 * "₹2.5Cr". Anything under a lakh is grouped in full.
 */
export function formatCompactINR(paise: number): string {
  const rupees = paise / 100;
  if (!Number.isFinite(rupees)) return "₹0";
  const sign = rupees < 0 ? "-" : "";
  const abs = Math.abs(rupees);

  if (abs >= CRORE) return `${sign}₹${trim(abs / CRORE)}Cr`;
  if (abs >= LAKH) return `${sign}₹${trim(abs / LAKH)}L`;
  return `${sign}₹${formatNumberIN(abs)}`;
}

/** A compact figure for display plus the exact one behind it, for tooltips. */
export function compactAmount(paise: number): { short: string; exact: string } {
  return { short: formatCompactINR(paise), exact: formatINR(paise) };
}