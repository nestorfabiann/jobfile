const TZ = 'America/Chicago';

export type Visit = {
  id: string; listing_id: string | null; bid_id: string | null; project_id: string | null;
  title: string; note: string; duration_text: string;
  status: 'requested' | 'proposed' | 'confirmed' | 'canceled';
  slots: string[]; scheduled_for: string | null;
  requested_role: 'contractor' | 'homeowner' | null; last_role: 'contractor' | 'homeowner' | null;
  created_by: string | null; access: { gate?: string; pets?: string; parking?: string; other?: string } | null;
  created_at: string;
};

/** "2026-11-13T10:00" typed in Central time to a UTC ISO string. */
export function chiToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const want = Date.UTC(y, mo - 1, d, h, mi);
  let utc = want;
  for (let i = 0; i < 2; i++) {
    const shown = new Date(utc).toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T');
    const sm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(shown);
    if (!sm) return null;
    const [sy, smo, sd, sh, smi] = sm.slice(1).map(Number);
    utc += want - Date.UTC(sy, smo - 1, sd, sh, smi);
  }
  const out = new Date(utc);
  return Number.isNaN(out.getTime()) ? null : out.toISOString();
}

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The Central calendar day of a moment, as YYYY-MM-DD. */
export const chiDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });

export const other = (role: 'contractor' | 'homeowner') => (role === 'contractor' ? 'homeowner' : 'contractor');

/** What this viewer should do about a visit, if anything. */
export function visitTodo(v: Visit, role: 'contractor' | 'homeowner'): 'propose' | 'pick' | null {
  if (v.status === 'requested' && v.requested_role && v.requested_role !== role) return 'propose';
  if (v.status === 'proposed' && v.last_role && v.last_role !== role) return 'pick';
  return null;
}
