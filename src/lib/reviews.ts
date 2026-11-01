import { supabaseAdmin } from './supabase/server';

/** Ratings between homeowners and contractors. To remove the feature, see the README. */

export const HOME_CATS = {
  quality: 'Quality of work',
  communication: 'Communication',
  on_time: 'Finished on time',
  clean: 'Kept the site clean',
  price: 'Fair price and changes',
} as const;
export const PRO_CATS = {
  communication: 'Communication',
  decisions: 'Quick decisions',
  paid_on_time: 'Paid on time',
  access: 'Access to the site',
} as const;
export const REVEAL_DAYS = 14;
export const catsFor = (reviewerRole: 'homeowner' | 'contractor'): Record<string, string> =>
  reviewerRole === 'homeowner' ? HOME_CATS : PRO_CATS;

/** Contractors may see a private summary of a homeowner's past ratings only when this is switched on. */
export const homeownerSummaryVisible = () => process.env.HOMEOWNER_RATINGS_VISIBLE === 'true';

export type ReviewRow = {
  id: string;
  project_id: string;
  reviewer_id: string;
  reviewer_role: 'homeowner' | 'contractor';
  subject_company_id: string | null;
  subject_user_id: string | null;
  overall: number;
  categories: Record<string, number>;
  comment: string;
  reply: string | null;
  reply_at: string | null;
  reported_at: string | null;
  hidden_at: string | null;
  created_at: string;
};

export const initialName = (n: string) => {
  const p = n.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return 'Homeowner';
  return p.length === 1 ? p[0] : `${p[0]} ${p[p.length - 1][0]}.`;
};

export const revealedBy = (completedAt: string | null, hasOther: boolean) =>
  hasOther || (!!completedAt && Date.now() >= new Date(completedAt).getTime() + REVEAL_DAYS * 86400_000);

/** Keep only reviews that are revealed (the other side rated, or 14 days passed) and not hidden by an admin. */
export async function publicReviews(rows: ReviewRow[]): Promise<(ReviewRow & { project_name: string; homeowner_name: string })[]> {
  const live = rows.filter((r) => !r.hidden_at);
  if (!live.length) return [];
  const db = supabaseAdmin();
  const pids = Array.from(new Set(live.map((r) => r.project_id)));
  const [{ data: ps }, { data: all }] = await Promise.all([
    db.from('projects').select('id,name,homeowner_name,completed_at').in('id', pids),
    db.from('reviews').select('project_id,reviewer_role').in('project_id', pids),
  ]);
  const proj = new Map((ps ?? []).map((p: any) => [p.id, p]));
  const has = new Set((all ?? []).map((r: any) => `${r.project_id}:${r.reviewer_role}`));
  return live
    .filter((r) => {
      const p: any = proj.get(r.project_id);
      const other = r.reviewer_role === 'homeowner' ? 'contractor' : 'homeowner';
      return p && revealedBy(p.completed_at, has.has(`${r.project_id}:${other}`));
    })
    .map((r) => {
      const p: any = proj.get(r.project_id);
      return { ...r, project_name: p.name as string, homeowner_name: initialName(p.homeowner_name ?? '') };
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function summarize(rows: { overall: number; categories: Record<string, number> }[]) {
  const count = rows.length;
  const avg = count ? rows.reduce((s, r) => s + r.overall, 0) / count : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, pct: count ? Math.round((rows.filter((r) => r.overall === n).length / count) * 100) : 0 }));
  const sums: Record<string, { s: number; c: number }> = {};
  rows.forEach((r) =>
    Object.entries(r.categories ?? {}).forEach(([k, v]) => {
      if (v >= 1 && v <= 5) (sums[k] ??= { s: 0, c: 0 }), (sums[k].s += v), (sums[k].c += 1);
    }),
  );
  const cats = Object.fromEntries(Object.entries(sums).map(([k, x]) => [k, x.s / x.c])) as Record<string, number>;
  return { count, avg, dist, cats };
}

export async function companyReviews(companyId: string) {
  const { data } = await supabaseAdmin().from('reviews').select('*').eq('reviewer_role', 'homeowner').eq('subject_company_id', companyId);
  return publicReviews((data ?? []) as ReviewRow[]);
}
export async function homeownerReviews(userId: string) {
  const { data } = await supabaseAdmin().from('reviews').select('*').eq('reviewer_role', 'contractor').eq('subject_user_id', userId);
  return publicReviews((data ?? []) as ReviewRow[]);
}
