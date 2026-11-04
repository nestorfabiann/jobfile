import { supabaseAdmin } from '@/lib/supabase/server';
import { miles, zipCoords } from '@/lib/matching';
import { isCurrent, signedUrls } from '@/lib/companyProfile';
import { publicReviews, type ReviewRow } from '@/lib/reviews';

export type NearbyContractor = { id: string; name: string; miles: number };

/** The closest contractors (by business ZIP) within a radius. Hidden companies are left out. */
export async function nearbyContractors(zip: string, radius = 50, limit = 3): Promise<{ total: number; top: NearbyContractor[] }> {
  const db = supabaseAdmin();
  const { data } = await db.from('companies').select('*').not('business_zip', 'is', null).limit(1000);
  const cos = ((data ?? []) as any[]).filter((c) => !c.hidden_at && /^\d{5}$/.test(c.business_zip ?? ''));
  if (!cos.length) return { total: 0, top: [] };
  const coords = await zipCoords([zip, ...cos.map((c) => c.business_zip as string)]);
  const center = coords.get(zip);
  if (!center) return { total: 0, top: [] };
  const near: NearbyContractor[] = [];
  for (const c of cos) {
    const at = coords.get(c.business_zip as string);
    if (!at) continue;
    const d = Math.round(miles(center, at));
    if (d <= radius) near.push({ id: c.id as string, name: (c.name as string) || 'Contractor', miles: d });
  }
  near.sort((a, b) => a.miles - b.miles);
  return { total: near.length, top: near.slice(0, limit) };
}

export type NearbyFull = NearbyContractor & { trades: string[] };

/** Every visible contractor within the radius, closest first, optionally for one trade. */
export async function nearbyAll(zip: string, trade = '', radius = 50, limit = 40): Promise<NearbyFull[]> {
  const db = supabaseAdmin();
  const { data } = await db.from('companies').select('*').not('business_zip', 'is', null).limit(1000);
  const cos = ((data ?? []) as any[]).filter((c) => !c.hidden_at && /^\d{5}$/.test(c.business_zip ?? ''));
  if (!cos.length) return [];
  const coords = await zipCoords([zip, ...cos.map((c) => c.business_zip as string)]);
  const center = coords.get(zip);
  if (!center) return [];
  const out: NearbyFull[] = [];
  for (const c of cos) {
    const trades: string[] = c.trades ?? [];
    if (trade && trades.length && !trades.includes(trade)) continue;
    const at = coords.get(c.business_zip as string);
    if (!at) continue;
    const d = Math.round(miles(center, at));
    if (d <= radius) out.push({ id: c.id as string, name: (c.name as string) || 'Contractor', miles: d, trades });
  }
  out.sort((a, b) => a.miles - b.miles);
  return out.slice(0, limit);
}

export type NearbyCard = NearbyFull & {
  logo: string;
  verified: boolean;
  insured: boolean;
  avg: number;
  count: number;
  since: number | null;
  photos: string[];
};

/** Nearby contractors with what homeowners look for: logo, verified badge, rating, insurance and work photos. */
export async function nearbyCards(zip: string, trade = '', radius = 50, limit = 40): Promise<NearbyCard[]> {
  const base = await nearbyAll(zip, trade, radius, 200);
  if (!base.length) return [];
  const db = supabaseAdmin();
  const ids = base.map((c) => c.id);
  const [{ data: cos }, { data: ins }, { data: ph }, { data: rv }] = await Promise.all([
    db.from('companies').select('*').in('id', ids),
    db.from('company_insurance').select('company_id,status,expires_on').in('company_id', ids),
    db.from('company_photos').select('company_id,path').in('company_id', ids).order('created_at'),
    db.from('reviews').select('*').eq('reviewer_role', 'homeowner').in('subject_company_id', ids),
  ]);
  const co = new Map(((cos ?? []) as any[]).map((c) => [c.id as string, c]));
  const shown = await publicReviews((rv ?? []) as unknown as ReviewRow[]);
  const photos = new Map<string, string[]>();
  ((ph ?? []) as any[]).forEach((p) => {
    const l = photos.get(p.company_id as string) ?? [];
    if (l.length < 3) l.push(p.path as string);
    photos.set(p.company_id as string, l);
  });
  const urls = await signedUrls('company-photos', [
    ...((cos ?? []) as any[]).map((c) => c.logo_path as string).filter(Boolean),
    ...Array.from(photos.values()).flat(),
  ]);
  const cards: NearbyCard[] = base.map((b) => {
    const c: any = co.get(b.id) ?? {};
    const mine = shown.filter((r) => r.subject_company_id === b.id);
    const avg = mine.length ? mine.reduce((s, r) => s + r.overall, 0) / mine.length : 0;
    return {
      ...b,
      logo: c.logo_path ? urls.get(c.logo_path as string) ?? '' : '',
      verified: !!c.verified_at && !c.hidden_at,
      insured: ((ins ?? []) as any[]).some((i) => i.company_id === b.id && isCurrent(i)),
      avg,
      count: mine.length,
      since: (c.year_started as number | null) ?? null,
      photos: (photos.get(b.id) ?? []).map((p) => urls.get(p) ?? '').filter(Boolean),
    };
  });
  // Distance still leads. Verified, insured and well-rated contractors move up a few miles' worth.
  const rank = (c: NearbyCard) => c.miles - (c.verified ? 4 : 0) - (c.insured ? 3 : 0) - (c.count >= 3 && c.avg >= 4.5 ? 5 : 0);
  cards.sort((a, b) => rank(a) - rank(b));
  return cards.slice(0, limit);
}
