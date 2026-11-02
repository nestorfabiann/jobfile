// Client-safe: no server-only imports, so client components can use it.
/** Where a price sits against the AI range, for the comparison bar: 0 to 100, clamped. */
export function barPos(price: number, lo: number, hi: number) {
  const span = hi - lo || 1;
  const rangeStart = 18, rangeEnd = 78; // the range is drawn between 18% and 78% of the bar
  const p = rangeStart + ((price - lo) / span) * (rangeEnd - rangeStart);
  return Math.max(2, Math.min(98, p));
}
