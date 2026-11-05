import { supabaseAdmin } from './supabase/server';

export const PUSH_KEYS = ['bids', 'visits', 'pay', 'msg', 'tips'] as const;
export type PushKey = (typeof PUSH_KEYS)[number];
export type PushPrefs = Record<PushKey, boolean>;
export const DEFAULT_PREFS: PushPrefs = { bids: true, visits: true, pay: true, msg: false, tips: false };

export const pushConfigured = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/** Which settings switch an alert belongs to. Kinds with no switch (agreements, photos and so on) are always sent. */
export function pushCategory(kind: string): PushKey | null {
  const k = kind.toLowerCase();
  if (k === 'bid' || k === 'community') return 'bids';
  if (k === 'community_note') return 'msg';
  if (k === 'visit' || k === 'schedule') return 'visits';
  if (k === 'payment' || k === 'change' || k === 'co' || k === 'ms') return 'pay';
  if (k === 'message') return 'msg';
  if (k === 'admin') return 'tips';
  return null;
}

export const cleanPrefs = (raw: unknown): PushPrefs => {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PREFS };
  PUSH_KEYS.forEach((k) => { if (typeof o[k] === 'boolean') out[k] = o[k] as boolean; });
  return out;
};

/** Send a phone alert to everything this person turned on. Never throws. Message text is never put in a phone alert. */
export async function sendPush(userId: string, a: { kind: string; title: string; body: string; url: string }) {
  if (!pushConfigured()) return;
  try {
    const db = supabaseAdmin();
    const { data } = await db.from('push_subscriptions').select('id,endpoint,p256dh,auth,prefs').eq('user_id', userId);
    const subs = (data ?? []) as { id: string; endpoint: string; p256dh: string; auth: string; prefs: unknown }[];
    if (!subs.length) return;
    const cat = pushCategory(a.kind);
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || (process.env.APP_URL || 'https://jobfile-rosy.vercel.app'), process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string, process.env.VAPID_PRIVATE_KEY as string);
    const payload = JSON.stringify({
      title: a.title.slice(0, 120),
      body: a.kind === 'message' ? 'Open Jobfile to read it.' : a.body.slice(0, 160),
      url: a.url,
      tag: a.kind,
    });
    await Promise.allSettled(
      subs.filter((s) => !cat || cleanPrefs(s.prefs)[cat]).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
        }
      }),
    );
  } catch { /* a phone alert must never break the action that caused it */ }
}
