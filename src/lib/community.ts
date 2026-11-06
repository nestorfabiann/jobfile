import { supabaseAdmin } from '@/lib/supabase/server';
import { signedUrls } from '@/lib/companyProfile';
import { firstNameInitial } from '@/lib/marketplace';

export const COMMUNITY_BUCKET = 'community-photos';
export const MAX_COMMENTS_PER_DAY = 20;
export const MAX_IDEAS_PER_DAY = 3;
export const MAX_OPEN_SHOWCASES = 5;
export const MAX_TIPS_PER_DAY = 3;
export const TIP_MAX = 400;
/** Trades where a wrong tip can hurt someone. Tips here get a safety line. */
export const RISKY_TRADES = ['Electrical', 'Plumbing', 'HVAC', 'Roofing', 'Foundation', 'Gas'];
export const HOLD_AFTER_REPORTS = 3;

export type Post = {
  id: string; kind: 'showcase' | 'idea' | 'tip'; author_id: string; author_role: 'contractor' | 'homeowner'; company_id: string | null; project_id: string | null;
  title: string; body: string; trade: string; city: string; days: number | null; cost_low_cents: number | null; cost_high_cents: number | null;
  before_path: string | null; after_path: string | null; photo_path: string | null; poll: { label: string }[];
  status: 'pending_other' | 'pending_review' | 'live' | 'rejected' | 'held' | 'removed'; reject_reason: string; created_at: string;
};
export const STATUS_LABEL: Record<Post['status'], string> = {
  pending_other: 'Waiting for the other side to approve', pending_review: 'Waiting for Jobfile to review', live: 'Live', rejected: 'Not approved', held: 'Hidden after reports', removed: 'Removed',
};

export const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  const d = Math.round(m / 1440);
  return d < 30 ? `${d} day${d > 1 ? 's' : ''} ago` : new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });
};

export async function photoUrls(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  return signedUrls(COMMUNITY_BUCKET, Array.from(new Set(paths.filter((p): p is string => !!p))), 6 * 3600);
}

/** Names shown next to posts and comments. A company (a Pro) shows its business name; everyone else shows first name and last initial. */
export async function nameMaps(userIds: string[], companyIds: string[]) {
  const db = supabaseAdmin();
  const uids = Array.from(new Set(userIds));
  const cids = Array.from(new Set(companyIds.filter(Boolean)));
  const [{ data: ps }, { data: cs }] = await Promise.all([
    uids.length ? db.from('profiles').select('id,full_name').in('id', uids) : Promise.resolve({ data: [] as any[] }),
    cids.length ? db.from('companies').select('id,name,verified_at').in('id', cids) : Promise.resolve({ data: [] as any[] }),
  ]);
  const person = new Map<string, string>(((ps ?? []) as any[]).map((p) => [p.id as string, p.full_name ? firstNameInitial(p.full_name as string) : 'A neighbor'] as [string, string]));
  const company = new Map<string, { name: string; verified: boolean }>(((cs ?? []) as any[]).map((c) => [c.id as string, { name: c.name as string, verified: !!c.verified_at }] as [string, { name: string; verified: boolean }]));
  return { person, company };
}

/** Like counts, comment counts, and what the signed-in person already liked or saved. */
export async function postStats(ids: string[], userId: string) {
  const db = supabaseAdmin();
  const out = { likes: new Map<string, number>(), comments: new Map<string, number>(), votes: new Map<string, number>(), liked: new Set<string>(), saved: new Set<string>() };
  if (!ids.length) return out;
  const [l, c, v, mineL, mineS] = await Promise.all([
    db.from('community_likes').select('post_id').in('post_id', ids).limit(20000),
    db.from('community_comments').select('post_id').in('post_id', ids).eq('status', 'live').limit(20000),
    db.from('community_votes').select('post_id').in('post_id', ids).limit(20000),
    db.from('community_likes').select('post_id').in('post_id', ids).eq('user_id', userId),
    db.from('community_saves').select('post_id').in('post_id', ids).eq('user_id', userId),
  ]);
  const tally = (rows: any[] | null, m: Map<string, number>) => (rows ?? []).forEach((r) => m.set(r.post_id as string, (m.get(r.post_id as string) ?? 0) + 1));
  tally(l.data as any[], out.likes); tally(c.data as any[], out.comments); tally(v.data as any[], out.votes);
  ((mineL.data ?? []) as any[]).forEach((r) => out.liked.add(r.post_id as string));
  ((mineS.data ?? []) as any[]).forEach((r) => out.saved.add(r.post_id as string));
  return out;
}

export const costText = (p: Pick<Post, 'cost_low_cents' | 'cost_high_cents'>) => {
  if (p.cost_low_cents == null || p.cost_high_cents == null) return '';
  const k = (c: number) => (c >= 100000 ? `$${(c / 100000).toFixed(1).replace(/\.0$/, '')}k` : `$${Math.round(c / 100)}`);
  return `${k(p.cost_low_cents)} – ${k(p.cost_high_cents)}`;
};
