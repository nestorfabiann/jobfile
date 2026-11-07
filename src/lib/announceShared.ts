export type AnnStyle = 'banner' | 'sheet' | 'picture';
export type Ann = {
  id: string; title: string; body: string; button_text: string; button_href: string;
  style: AnnStyle; color: 'green' | 'orange' | 'blue' | 'violet';
  image_path: string; image_alt: string; image_mode: 'top' | 'full';
  role: 'homeowners' | 'contractors' | 'everyone'; zips: string[]; activity: 'any' | 'posted' | 'noproject' | 'nobids';
  status: 'draft' | 'live' | 'ended'; ends_at: string | null; created_at: string;
};

export const COLORS: Record<Ann['color'], [string, string]> = {
  green: ['#1f4d3a', '#2f7a57'], orange: ['#a8611f', '#c4813f'], blue: ['#1b56e0', '#0a33a8'], violet: ['#5b4bb0', '#7a6bd0'],
};
export const ACTIVITY_LABEL: Record<Ann['activity'], string> = { any: 'Anyone', posted: 'Posted 1+ project', noproject: 'No project yet', nobids: 'Project with no bids yet' };

/** Jobfile pages (start with one slash) or https web addresses. Anything else becomes empty. */
export function cleanHref(h: string): string {
  const s = String(h ?? '').trim().slice(0, 300);
  if (/^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/.test(s)) return s;
  if (/^https:\/\/[^\s<>"']+$/i.test(s)) return s;
  return '';
}
export const parseZips = (t: string): string[] => Array.from(new Set(String(t ?? '').split(/[\s,;]+/).filter((z) => /^\d{5}$/.test(z)))).slice(0, 200);

export type Person = { id: string; role: 'homeowner' | 'contractor'; zip: string | null; posted: boolean; nobids: boolean };

export function matches(p: Person, a: Pick<Ann, 'role' | 'zips' | 'activity'>): boolean {
  if (a.role === 'homeowners' && p.role !== 'homeowner') return false;
  if (a.role === 'contractors' && p.role !== 'contractor') return false;
  if (a.zips.length && !(p.zip && a.zips.includes(p.zip))) return false;
  if (a.activity !== 'any') {
    if (p.role !== 'homeowner') return false;
    if (a.activity === 'posted' && !p.posted) return false;
    if (a.activity === 'noproject' && p.posted) return false;
    if (a.activity === 'nobids' && !p.nobids) return false;
  }
  return true;
}

