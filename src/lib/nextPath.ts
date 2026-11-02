/** Only allow going back to a page inside the app that signed-in people use. */
export function safeNext(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  if (!s.startsWith('/') || s.startsWith('//') || s.includes('\\')) return '';
  return /^\/(marketplace|jobs|projects|invites)(\/|$|\?)/.test(s) ? s.slice(0, 200) : '';
}
export const NEXT_COOKIE = 'jf_next';
