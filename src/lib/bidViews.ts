import type { SupabaseClient } from '@supabase/supabase-js';

// A bid counts as viewed again only after this long, so a refresh does not inflate the count.
const AGAIN_MS = 30 * 60 * 1000;

type ViewBid = { id: string; status: string; first_viewed_at?: string | null; last_viewed_at?: string | null; view_count?: number | null };

/** Homeowner opened their bid list: note a view on each bid still waiting. Ignored if the 018 columns are not there yet. */
export async function recordBidViews(db: SupabaseClient, bids: ViewBid[]) {
  const now = new Date().toISOString();
  for (const b of bids) {
    if (b.status !== 'waiting' || !('view_count' in b)) continue;
    if (!b.first_viewed_at) {
      await db.from('marketplace_bids').update({ first_viewed_at: now, last_viewed_at: now, view_count: 1 }).eq('id', b.id);
    } else if (!b.last_viewed_at || Date.now() - new Date(b.last_viewed_at).getTime() > AGAIN_MS) {
      await db.from('marketplace_bids').update({ last_viewed_at: now, view_count: (b.view_count ?? 1) + 1 }).eq('id', b.id);
    }
  }
}

/** Homeowner put these bids side by side. */
export async function recordCompared(db: SupabaseClient, ids: string[]) {
  if (ids.length) await db.from('marketplace_bids').update({ compared_at: new Date().toISOString() }).in('id', ids);
}

/** Contractor opened their bid: the "viewed" row leaves Needs you. */
export async function ackBidView(db: SupabaseClient, bid: { id: string; first_viewed_at?: string | null; viewed_ack_at?: string | null }) {
  if (bid.first_viewed_at && !bid.viewed_ack_at) await db.from('marketplace_bids').update({ viewed_ack_at: new Date().toISOString() }).eq('id', bid.id);
}

const tz = 'America/Chicago';
const dayKey = (d: Date) => d.toLocaleDateString('en-US', { timeZone: tz });

function whenText(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return `today at ${d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })}`;
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86400000))) return 'yesterday';
  return d.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' });
}

/** The status strip on a contractor's bid card. No time spent is ever shown. */
export function viewStatus(b: { first_viewed_at?: string | null; last_viewed_at?: string | null; view_count?: number | null; compared_at?: string | null }): { tone: 'none' | 'seen' | 'hot'; text: string } {
  if (!b.first_viewed_at) return { tone: 'none', text: 'Not viewed yet' };
  const n = b.view_count ?? 1;
  if (b.compared_at) return { tone: 'hot', text: `In the homeowner's comparison · viewed ${n} time${n === 1 ? '' : 's'}` };
  if (n <= 1) return { tone: 'seen', text: `Viewed by the homeowner · ${whenText(b.first_viewed_at)}` };
  return { tone: 'seen', text: `Viewed ${n} times · last ${whenText(b.last_viewed_at ?? b.first_viewed_at)}` };
}

/** Bids the homeowner has viewed that the contractor has not opened yet: one Needs you row each. Same rules for the page and the tab badge. */
export async function unseenViews(db: SupabaseClient, companyId: string) {
  const { data } = await db.from('marketplace_bids').select('*').eq('company_id', companyId).eq('status', 'waiting');
  const hit = ((data ?? []) as any[]).filter((b) => b.first_viewed_at && !b.viewed_ack_at);
  if (!hit.length) return [] as { bid: any; listing: any }[];
  const { data: ls } = await db.from('marketplace_listings').select('*').in('id', hit.map((b) => b.listing_id));
  const now = Date.now();
  return hit
    .map((bid) => ({ bid, listing: (ls ?? []).find((l: any) => l.id === bid.listing_id) }))
    .filter((x) => x.listing && x.listing.status === 'open' && new Date(x.listing.expires_at).getTime() > now);
}
