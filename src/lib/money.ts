/** All amounts are whole cents. */

export function dollars(cents: number): string {
  const neg = cents < 0;
  const a = Math.abs(cents) / 100;
  const s =
    '$' +
    a.toLocaleString('en-US', {
      minimumFractionDigits: Number.isInteger(a) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  return neg ? `−${s}` : s;
}

export const signedDollars = (cents: number) => (cents > 0 ? '+' : '') + dollars(cents);

/** "12,500.50" or "$12500" to cents. Anything unreadable becomes 0. */
export function parseDollars(input: string): number {
  const n = parseFloat(String(input).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Cents back to a plain number string for an input box, e.g. 1250050 -> "12500.5". */
export const centsToInput = (cents: number) => (cents ? String(cents / 100) : '');

export const daysText = (n: number) =>
  n === 0 ? 'No schedule change' : `${n > 0 ? '+' : '−'}${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}`;
