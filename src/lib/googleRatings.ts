import { supabaseAdmin } from '@/lib/supabase/server';

/** Google ratings a contractor links to their profile. Looked up with the Places API, shown as Google reports them, never added to the Jobfile score. */

export type OutsideRating = { source: 'google'; name: string; rating: number; count: number; url: string };

const KEY = () => process.env.GOOGLE_PLACES_API_KEY ?? '';
export const googleConfigured = () => !!KEY();

const HOST_OK = (h: string) => /(^|\.)(google\.com|goo\.gl|g\.page|g\.co)$/i.test(h);
const MAX_AGE_MS = 24 * 3600 * 1000; // refresh daily
const SHOW_MAX_MS = 30 * 24 * 3600 * 1000; // never show data older than Google allows us to keep

type Found = { id: string; name: string; address: string; rating: number | null; count: number | null; url: string };

const timeout = () => AbortSignal.timeout(6000);

/** Follows a short Google link to the real Maps address. Only ever visits Google hosts. */
async function follow(url: string): Promise<string> {
  let cur = url;
  for (let i = 0; i < 4; i++) {
    let u: URL;
    try { u = new URL(cur); } catch { return cur; }
    if (!HOST_OK(u.hostname)) return cur;
    if (u.pathname.startsWith('/maps/place/')) return cur;
    const r = await fetch(cur, { redirect: 'manual', signal: timeout(), headers: { 'user-agent': 'Mozilla/5.0 (compatible; Jobfile)' } });
    const next = r.headers.get('location');
    if (!next || r.status < 300 || r.status > 399) return cur;
    cur = new URL(next, cur).toString();
  }
  return cur;
}

/** Turns what the contractor typed into a search phrase: the name inside a Maps link, or their own words. */
export async function searchPhrase(input: string, zip: string): Promise<string | null> {
  const t = input.trim();
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) return zip ? `${t} ${zip}` : t;
  let u: URL;
  try { u = new URL(t); } catch { return null; }
  if (!HOST_OK(u.hostname)) return null;
  const real = await follow(t);
  const m = /\/maps\/place\/([^/@?]+)/.exec(real);
  if (!m) return null;
  try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch { return null; }
}

const MASK = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri';

export async function findPlace(query: string): Promise<Found | null> {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal: timeout(),
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': KEY(), 'X-Goog-FieldMask': MASK },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!r.ok) throw new Error(`places ${r.status}`);
  const d = (await r.json()) as { places?: any[] };
  const p = d.places?.[0];
  if (!p) return null;
  return { id: p.id, name: p.displayName?.text ?? '', address: p.formattedAddress ?? '', rating: typeof p.rating === 'number' ? p.rating : null, count: typeof p.userRatingCount === 'number' ? p.userRatingCount : null, url: p.googleMapsUri ?? '' };
}

async function readPlace(id: string): Promise<{ rating: number | null; count: number | null; url: string } | null> {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
    signal: timeout(),
    headers: { 'X-Goog-Api-Key': KEY(), 'X-Goog-FieldMask': 'id,rating,userRatingCount,googleMapsUri' },
  });
  if (!r.ok) return null;
  const p = (await r.json()) as any;
  return { rating: typeof p.rating === 'number' ? p.rating : null, count: typeof p.userRatingCount === 'number' ? p.userRatingCount : null, url: p.googleMapsUri ?? '' };
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/\b(llc|inc|co|corp|ltd|the|and|company)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
/** True when most of the shorter name's words appear in the other. */
export function sameBusiness(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x.length || !y.length) return false;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return s.filter((w) => l.includes(w)).length / s.length >= 0.6;
}

/** Approved Google rating for a company, refreshed at most once a day. Returns nothing when stale or missing. */
export async function companyOutsideRatings(companyId: string): Promise<OutsideRating[]> {
  if (!googleConfigured()) return [];
  try {
    const db = supabaseAdmin();
    const { data: row } = await db.from('company_ratings').select('*').eq('company_id', companyId).eq('source', 'google').eq('status', 'approved').maybeSingle<any>();
    if (!row) return [];
    let { rating, review_count: count, maps_url: url, fetched_at: at } = row;
    const age = at ? Date.now() - new Date(at).getTime() : Infinity;
    if (age > MAX_AGE_MS && row.place_id) {
      try {
        const fresh = await readPlace(row.place_id);
        if (fresh) {
          rating = fresh.rating; count = fresh.count; url = fresh.url || url; at = new Date().toISOString();
          await db.from('company_ratings').update({ rating, review_count: count, maps_url: url, fetched_at: at }).eq('company_id', companyId).eq('source', 'google');
        }
      } catch { /* keep what we have */ }
    }
    if (rating == null || !count || !at || Date.now() - new Date(at).getTime() > SHOW_MAX_MS) return [];
    return [{ source: 'google', name: row.place_name, rating: Number(rating), count: Number(count), url: url || '' }];
  } catch {
    return []; // table not created yet
  }
}
