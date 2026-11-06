import { supabaseAdmin } from '@/lib/supabase/server';
import { JOB_TYPES } from '@/lib/marketplace';
import { publicReviews, summarize } from '@/lib/reviews';
import { signedUrls } from '@/lib/companyProfile';

/** What a signed-out visitor may see. No street address, homeowner name, notes, budget, photos or bidder names. */
export type PublicListing = {
  id: string; job_type: string; items: string[]; size_sqft: number | null; zip: string; city: string;
  ai_low_cents: number | null; ai_high_cents: number | null; ai_likely_cents: number | null; ai_confidence: string | null;
  ai_breakdown: { group: string; low: number; high: number }[]; ai_notes: string;
  status: string; expires_at: string; created_at: string; homeowner_id: string;
};

const FIELDS = 'id,job_type,items,size_sqft,zip,city,ai_low_cents,ai_high_cents,ai_likely_cents,ai_confidence,ai_breakdown,ai_notes,status,expires_at,created_at,homeowner_id';

async function bidCounts(ids: string[]) {
  const counts = new Map<string, number>();
  if (!ids.length) return counts;
  const { data } = await supabaseAdmin().from('marketplace_bids').select('listing_id,status').in('listing_id', ids);
  (data ?? []).forEach((b: any) => {
    if (b.status !== 'withdrawn') counts.set(b.listing_id, (counts.get(b.listing_id) ?? 0) + 1);
  });
  return counts;
}

export async function publicListings(type: string, limit: number) {
  let q = supabaseAdmin()
    .from('marketplace_listings')
    .select(FIELDS)
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);
  if (type && JOB_TYPES[type]) q = q.eq('job_type', type);
  const { data } = await q;
  const listings = (data ?? []) as PublicListing[];
  return { listings, counts: await bidCounts(listings.map((l) => l.id)) };
}

export async function publicListing(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin().from('marketplace_listings').select(FIELDS).eq('id', id).maybeSingle();
  if (!data) return null;
  const l = data as PublicListing;
  const counts = await bidCounts([l.id]);
  return { listing: l, bids: counts.get(l.id) ?? 0, open: l.status === 'open' && new Date(l.expires_at).getTime() > Date.now() };
}

/** First photo and photo count for each listing. Only call this for a signed-in contractor: signed-out visitors never see photos. */
export async function listingThumbs(ids: string[]) {
  const out = new Map<string, { url: string | null; count: number }>();
  ids.forEach((id) => out.set(id, { url: null, count: 0 }));
  if (!ids.length) return out;
  const db = supabaseAdmin();
  const { data } = await db.from('marketplace_photos').select('listing_id,path').in('listing_id', ids).order('created_at').limit(2000);
  const first = new Map<string, string>();
  ((data ?? []) as any[]).forEach((p) => {
    const o = out.get(p.listing_id as string);
    if (!o) return;
    o.count += 1;
    if (!first.has(p.listing_id as string)) first.set(p.listing_id as string, p.path as string);
  });
  const urls = await signedUrls('listing-photos', Array.from(first.values()), 3600);
  first.forEach((path, id) => { out.get(id)!.url = urls.get(path) ?? null; });
  return out;
}

/** True when the signed-in person works for a company, so they may see job photos. */
export async function isContractor(userId: string | null | undefined) {
  if (!userId) return false;
  const { data } = await supabaseAdmin().from('company_members').select('company_id').eq('user_id', userId).limit(1);
  return (data ?? []).length > 0;
}

/** Real numbers for the landing page. A value is null until there is something true to show. */
export async function landingStats(): Promise<{ posted: number | null; pros: number | null; rating: { avg: number; count: number } | null }> {
  try {
    const db = supabaseAdmin();
    const [{ count: posted }, { count: pros }, { data: rows }] = await Promise.all([
      db.from('marketplace_listings').select('id', { count: 'exact', head: true }),
      db.from('companies').select('id', { count: 'exact', head: true }).not('business_zip', 'is', null),
      db.from('reviews').select('*').eq('reviewer_role', 'homeowner').limit(2000),
    ]);
    const shown = await publicReviews((rows ?? []) as any[]);
    const sum = summarize(shown);
    return { posted: posted ? posted : null, pros: pros ? pros : null, rating: sum.count ? { avg: sum.avg, count: sum.count } : null };
  } catch {
    return { posted: null, pros: null, rating: null };
  }
}
