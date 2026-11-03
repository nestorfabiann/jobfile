import { randomBytes } from 'crypto';
import { supabaseAdmin } from './supabase/server';

export const REF_COOKIE = 'jf_ref';
export const INVITE_SKIP_COOKIE = 'jf_invite_skip';
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const validCode = (c: string) => /^[A-Z0-9]{6}$/.test(c);

function newCode() {
  const b = randomBytes(6);
  return Array.from(b).map((x) => ALPHA[x % ALPHA.length]).join('');
}

/** The person's invite code. Made the first time they ask. */
export async function getOrCreateCode(userId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db.from('invite_codes').select('code').eq('user_id', userId).maybeSingle();
  if (data?.code) return data.code as string;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const { error } = await db.from('invite_codes').insert({ user_id: userId, code });
    if (!error) return code;
    const { data: again } = await db.from('invite_codes').select('code').eq('user_id', userId).maybeSingle();
    if (again?.code) return again.code as string;
  }
  return null;
}

export type InviteStats = { opened: number; joined: number; posted: number };

export async function inviteStats(code: string): Promise<InviteStats> {
  const db = supabaseAdmin();
  const [{ count: opened }, { data: joins }] = await Promise.all([
    db.from('invite_events').select('id', { count: 'exact', head: true }).eq('code', code).eq('kind', 'open'),
    db.from('invite_events').select('invitee_id').eq('code', code).eq('kind', 'join').limit(1000),
  ]);
  const ids = (joins ?? []).map((j: any) => j.invitee_id as string).filter(Boolean);
  let posted = 0;
  if (ids.length) {
    const { data: ls } = await db.from('marketplace_listings').select('homeowner_id').in('homeowner_id', ids).limit(5000);
    posted = new Set((ls ?? []).map((l: any) => l.homeowner_id as string)).size;
  }
  return { opened: opened ?? 0, joined: ids.length, posted };
}

/** Called after sign-in. Counts a join once, only for a new account, and never for your own code. */
export async function recordJoin(user: { id: string; created_at?: string }, code: string | undefined) {
  try {
    if (!code || !validCode(code)) return;
    if (!user.created_at || Date.now() - new Date(user.created_at).getTime() > 3 * 24 * 3600_000) return;
    const db = supabaseAdmin();
    const { data: owner } = await db.from('invite_codes').select('user_id').eq('code', code).maybeSingle();
    if (!owner || owner.user_id === user.id) return;
    await db.from('invite_events').insert({ code, kind: 'join', invitee_id: user.id });
  } catch { /* never block sign-in */ }
}
