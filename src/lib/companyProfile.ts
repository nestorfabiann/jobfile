import { requireUser } from './session';
import { supabaseAdmin } from './supabase/server';

export const SERVICES = ['Interior painting', 'Exterior painting', 'Cabinets', 'Drywall repair', 'Pressure washing', 'Kitchen remodel', 'Bathroom remodel', 'Flooring', 'Roofing', 'Fencing', 'Landscaping', 'Electrical', 'Plumbing', 'HVAC', 'Handyman'];
export const LANGUAGES = ['English', 'Español'];
export const PAYMENTS = ['Check', 'Zelle', 'Cash', 'Card', 'Venmo'];
export const INSURANCE_KINDS = { liability: 'General liability', workers_comp: "Workers' comp" } as const;
export type InsuranceKind = keyof typeof INSURANCE_KINDS;

/** The signed-in person's company, only if they own it. Returns null for everyone else. */
export async function myOwnedCompany() {
  const { sb, user } = await requireUser();
  const { data } = await sb.from('company_members').select('company_id, role, companies(id,name)').eq('user_id', user.id).eq('role', 'owner').limit(1);
  const row = (data ?? [])[0] as { company_id: string; companies?: { id: string; name: string } } | undefined;
  if (!row) return null;
  return { user, companyId: row.company_id, name: row.companies?.name ?? '' };
}

/** Makes a safe web link, or '' if it is not one. Only http and https are allowed. */
export function cleanUrl(raw: string): string {
  let s = raw.trim().slice(0, 300);
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (!u.hostname.includes('.')) return '';
    return u.toString();
  } catch {
    return '';
  }
}

/** An Instagram handle or link becomes a full link. */
export function instagramUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^@?[A-Za-z0-9._]{1,30}$/.test(s)) return `https://instagram.com/${s.replace(/^@/, '')}`;
  return cleanUrl(s);
}

export function pickFrom(all: string[], values: FormDataEntryValue[]): string[] {
  return values.map(String).filter((v) => all.includes(v));
}

export function intOrNull(v: FormDataEntryValue | null, min: number, max: number): number | null {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** An approved certificate counts only until the day it expires. */
export function isCurrent(ins: { status: string; expires_on: string }): boolean {
  return ins.status === 'approved' && ins.expires_on >= new Date().toISOString().slice(0, 10);
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export async function signedUrls(bucket: string, paths: string[], seconds = 3600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data } = await supabaseAdmin().storage.from(bucket).createSignedUrls(paths, seconds);
  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  });
  return out;
}
