import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyUsers } from '@/lib/notify';
import { dollars } from '@/lib/money';
import { listingTitle } from '@/lib/marketplace';

export const DEFAULT_RADIUS = 25;
export const DAILY_JOB_ALERTS = 10;
const MAX_LOOKUPS = 25;

/** Straight-line miles between two [lat, lng] points. */
export function miles(a: [number, number], b: [number, number]) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** ZIP to location. Uses our saved copy first, and asks a free public ZIP service for any new ones. */
export async function zipCoords(zips: string[]): Promise<Map<string, [number, number]>> {
  const out = new Map<string, [number, number]>();
  const want = Array.from(new Set(zips.filter((z) => /^\d{5}$/.test(z))));
  if (!want.length) return out;
  const db = supabaseAdmin();
  const { data } = await db.from('zip_coords').select('zip,lat,lng').in('zip', want);
  (data ?? []).forEach((r: any) => out.set(r.zip as string, [r.lat as number, r.lng as number]));
  const missing = want.filter((z) => !out.has(z)).slice(0, MAX_LOOKUPS);
  await Promise.all(
    missing.map(async (z) => {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 3000);
        const r = await fetch(`https://api.zippopotam.us/us/${z}`, { signal: ctl.signal, cache: 'no-store' });
        clearTimeout(timer);
        if (!r.ok) return;
        const j: any = await r.json();
        const p = j?.places?.[0];
        const lat = parseFloat(p?.latitude);
        const lng = parseFloat(p?.longitude);
        if (!isFinite(lat) || !isFinite(lng)) return;
        out.set(z, [lat, lng]);
        await db.from('zip_coords').upsert({ zip: z, lat, lng });
      } catch {
        /* no location for this ZIP; the job simply shows without a distance */
      }
    }),
  );
  return out;
}

type NewListing = { id: string; homeowner_id: string; job_type: string; zip: string; city: string; items: string[]; ai_low_cents: number | null; ai_high_cents: number | null };

/** Tell contractors whose trades and area match a newly posted job. Never throws. */
export async function alertMatchingContractors(l: NewListing) {
  try {
    const db = supabaseAdmin();
    const { data: cos } = await db.from('companies').select('*').eq('job_alerts', true).not('business_zip', 'is', null).limit(500);
    const candidates = ((cos ?? []) as any[]).filter((c) => !c.hidden_at && (!(c.trades ?? []).length || (c.trades as string[]).includes(l.job_type)));
    if (!candidates.length) return;
    const coords = await zipCoords([l.zip, ...candidates.map((c) => c.business_zip as string)]);
    const here = coords.get(l.zip);
    if (!here) return;
    const near = candidates.map((c) => {
      const at = coords.get(c.business_zip as string);
      return { id: c.id as string, d: at ? miles(here, at) : Infinity, radius: (c.service_radius_mi as number | null) ?? DEFAULT_RADIUS };
    }).filter((c) => c.d <= c.radius);
    if (!near.length) return;

    const { data: mem } = await db.from('company_members').select('company_id,user_id').in('company_id', near.map((c) => c.id));
    const dist = new Map(near.map((c) => [c.id, Math.round(c.d)] as [string, number]));
    const byUser = new Map<string, number>();
    (mem ?? []).forEach((m: any) => {
      if (m.user_id === l.homeowner_id) return;
      const d = dist.get(m.company_id as string);
      if (d == null) return;
      byUser.set(m.user_id as string, Math.min(byUser.get(m.user_id as string) ?? Infinity, d));
    });

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const range = l.ai_low_cents != null && l.ai_high_cents != null ? ` AI price reference: ${dollars(l.ai_low_cents)} – ${dollars(l.ai_high_cents)}.` : '';
    for (const [userId, d] of Array.from(byUser.entries())) {
      const { count } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', 'job_match').gt('created_at', startOfDay.toISOString());
      if ((count ?? 0) >= DAILY_JOB_ALERTS) continue;
      await notifyUsers({
        userIds: [userId],
        projectId: null,
        kind: 'job_match',
        title: `New ${l.job_type} job ${d <= 1 ? 'nearby' : `${d} miles away`}: ${listingTitle(l)}`,
        body: `A homeowner in ${[l.city, `TX ${l.zip}`].filter(Boolean).join(' ')} posted a project.${range} You get this because you chose ${l.job_type} jobs near your business. Turn alerts off in Settings > Business profile.`,
        path: `/marketplace/${l.id}`,
        cta: 'View job and bid',
      });
    }
  } catch {
    /* alerts are a bonus; posting must never fail because of them */
  }
}
