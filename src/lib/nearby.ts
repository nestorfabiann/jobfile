import { supabaseAdmin } from '@/lib/supabase/server';
import { miles, zipCoords } from '@/lib/matching';

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
