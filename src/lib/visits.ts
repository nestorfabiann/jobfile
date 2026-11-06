const TZ = 'America/Chicago';

export type Visit = {
  id: string; listing_id: string | null; bid_id: string | null; project_id: string | null;
  title: string; note: string; duration_text: string;
  status: 'asked' | 'requested' | 'proposed' | 'confirmed' | 'done' | 'canceled';
  slots: string[]; scheduled_for: string | null;
  requested_role: 'contractor' | 'homeowner' | null; last_role: 'contractor' | 'homeowner' | null;
  created_by: string | null; access: { gate?: string; pets?: string; parking?: string; other?: string } | null;
  live: { state?: 'on_way' | 'late15' | 'late30' | 'arrived'; at?: string } | null; report: string | null;
  created_at: string;
  done_at?: string | null; confirm_state?: 'pending' | 'yes' | 'no' | null; dispute_reason?: string | null;
};

export const CONFIRM_HOURS = 48;
/** Where the homeowner's check on a finished visit stands. No answer in 48 hours counts as confirmed. */
export function confirmView(v: Visit): 'none' | 'pending' | 'confirmed' | 'auto' {
  if (v.status !== 'done' || v.confirm_state !== 'pending') return v.status === 'done' && v.confirm_state === 'yes' ? 'confirmed' : 'none';
  const age = v.done_at ? (Date.now() - Date.parse(v.done_at)) / 3600000 : 0;
  return age >= CONFIRM_HOURS ? 'auto' : 'pending';
}

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
export function visitTodo(v: Visit, role: 'contractor' | 'homeowner'): 'propose' | 'pick' | 'approve' | 'confirm' | null {
  if (role === 'homeowner' && confirmView(v) === 'pending') return 'confirm';
  if (v.status === 'asked') return role === 'homeowner' ? 'approve' : null;
  if (v.status === 'requested' && v.requested_role && v.requested_role !== role) return 'propose';
  if (v.status === 'proposed' && v.last_role && v.last_role !== role) return 'pick';
  return null;
}

/** Plain-words countdown for a moment, in Central days. */
export function countdown(iso: string): string {
  const days = Math.round((Date.parse(chiDay(iso) + 'T12:00:00Z') - Date.parse(chiDay(new Date().toISOString()) + 'T12:00:00Z')) / 86400000);
  if (days < 0) return 'Past';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** Minutes a visit lasts, read from text like "30 minutes" or "1 hour". Defaults to 30. */
export function durationMinutes(text: string): number {
  const h = /(\d+(?:\.\d+)?)\s*h/i.exec(text);
  if (h) return Math.round(parseFloat(h[1]) * 60);
  const m = /(\d+)\s*m/i.exec(text);
  return m ? parseInt(m[1], 10) : 30;
}

/** A Google Calendar "add event" link. Pass a location only when it is safe to share with this person. */
export function calendarUrl(v: Visit, location?: string): string {
  const start = new Date(v.scheduled_for ?? Date.now());
  const end = new Date(start.getTime() + durationMinutes(v.duration_text) * 60000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: v.title, dates: `${f(start)}/${f(end)}`, details: 'Booked on Jobfile' });
  if (location) q.set('location', location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
