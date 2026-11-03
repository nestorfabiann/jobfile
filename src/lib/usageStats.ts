import { supabaseAdmin } from '@/lib/supabase/server';

type Db = ReturnType<typeof supabaseAdmin>;
export type UEvent = { user_id: string; kind: 'signin' | 'view' | 'ping'; page: string; created_at: string };
export type Visit = { user_id: string; start: number; end: number };

const GAP_MS = 30 * 60_000; // a visit ends after 30 minutes of nothing
const MIN_VISIT_MS = 30_000; // a one-page visit counts as at least 30 seconds
const DAY = 86_400_000;

/** Reads usage events in pages of 1000 (the database caps one request). Returns [] if the table is not there yet. */
export async function loadEvents(db: Db, sinceISO: string | null, userId?: string): Promise<UEvent[]> {
  const out: UEvent[] = [];
  for (let from = 0; from < 30000; from += 1000) {
    let q = db.from('usage_events').select('user_id,kind,page,created_at').order('created_at', { ascending: true }).range(from, from + 999);
    if (sinceISO) q = q.gte('created_at', sinceISO);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) return out;
    const rows = (data ?? []) as unknown as UEvent[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** Groups each person's events into visits. */
export function visitsOf(events: UEvent[]): Visit[] {
  const by = new Map<string, number[]>();
  for (const e of events) {
    const t = new Date(e.created_at).getTime();
    const list = by.get(e.user_id);
    if (list) list.push(t); else by.set(e.user_id, [t]);
  }
  const out: Visit[] = [];
  by.forEach((times, user_id) => {
    times.sort((a, b) => a - b);
    let start = times[0];
    let end = times[0];
    for (let i = 1; i < times.length; i++) {
      if (times[i] - end > GAP_MS) { out.push({ user_id, start, end: Math.max(end, start + MIN_VISIT_MS) }); start = times[i]; }
      end = times[i];
    }
    out.push({ user_id, start, end: Math.max(end, start + MIN_VISIT_MS) });
  });
  return out;
}

export const avgVisitMs = (v: Visit[]) => (v.length ? v.reduce((a, x) => a + (x.end - x.start), 0) / v.length : 0);
export const fmtDuration = (ms: number) => {
  if (!ms) return '0s';
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};
export const dayKey = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
export const periodDays = (r: string) => (r === '30' ? 30 : r === 'all' ? 0 : 7);
export { DAY };

export function ago(iso: string | null): string {
  if (!iso) return 'never';
  const d = Date.now() - new Date(iso).getTime();
  if (d < 3_600_000) return `${Math.max(1, Math.round(d / 60_000))} min ago`;
  if (d < DAY) return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }) + ' today';
  const days = Math.floor(d / DAY);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
