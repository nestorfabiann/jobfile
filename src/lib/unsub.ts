import { createHmac, timingSafeEqual } from 'node:crypto';

const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-secret';

/** Signed token so an email link can turn off one person's tips without signing in. */
export function unsubToken(userId: string): string {
  return createHmac('sha256', secret()).update(`unsub:${userId}`).digest('hex').slice(0, 32);
}

export function unsubValid(userId: string, token: string): boolean {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f]{32}$/.test(token)) return false;
  const a = Buffer.from(unsubToken(userId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const unsubLink = (appUrl: string, userId: string) => `${appUrl}/unsubscribe?u=${userId}&t=${unsubToken(userId)}`;
