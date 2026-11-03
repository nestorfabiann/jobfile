import { supabaseAdmin } from '@/lib/supabase/server';
import { DEFAULT_RADIUS, miles, zipCoords } from '@/lib/matching';
import { listingTitle, type Listing } from '@/lib/marketplace';

type Db = ReturnType<typeof supabaseAdmin>;
export type Attention = { key: string; title: string; sub: string; href: string; go: string; at: string };

const H = 3600_000;
const D = 24 * H;

/** Everything that waits on the admin, oldest first. Each row goes away when the thing is handled. */
export async function attentionItems(db: Db): Promise<Attention[]> {
  const now = Date.now();
  const out: Attention[] = [];

  const [ins, rev, failed, ags, lst, hlp] = await Promise.all([
    db.from('company_insurance').select('id,kind,uploaded_at,companies(name)').eq('status', 'pending').order('uploaded_at').limit(20),
    db.from('reviews').select('id,report_reason,reported_at').not('reported_at', 'is', null).is('hidden_at', null).order('reported_at').limit(20),
    db.from('notifications').select('id,created_at').not('error', 'is', null).gt('created_at', new Date(now - 7 * D).toISOString()).order('created_at').limit(200),
    db.from('agreements').select('project_id,sent_at,projects(name)').not('sent_at', 'is', null).is('executed_at', null).lt('sent_at', new Date(now - 7 * D).toISOString()).order('sent_at').limit(20),
    db.from('marketplace_listings').select('*').eq('status', 'open').gt('expires_at', new Date(now).toISOString()).lt('created_at', new Date(now - 48 * H).toISOString()).order('created_at').limit(100),
    db.from('help_messages').select('id,topic,body,created_at').is('done_at', null).order('created_at').limit(20),
  ]);

  (ins.data ?? []).forEach((i: any) => out.push({ key: `ins-${i.id}`, title: 'Review insurance certificate', sub: `${i.companies?.name ?? 'A company'}`, href: '/admin/verification', go: 'Review', at: i.uploaded_at }));
  (rev.data ?? []).forEach((r: any) => out.push({ key: `rev-${r.id}`, title: 'Reported review', sub: r.report_reason ? `"${String(r.report_reason).slice(0, 60)}"` : 'No reason given', href: '/admin/reviews', go: 'Open', at: r.reported_at }));
  if ((failed.data ?? []).length) out.push({ key: 'failed', title: `${failed.data!.length} alert${failed.data!.length === 1 ? '' : 's'} failed to send`, sub: 'Last 7 days', href: '/admin/activity', go: 'Check', at: (failed.data as any[])[0].created_at });
  (ags.data ?? []).forEach((a: any) => out.push({ key: `ag-${a.project_id}`, title: 'Agreement unsigned for 7 days', sub: a.projects?.name ?? 'Project', href: `/admin/projects/${a.project_id}`, go: 'Open', at: a.sent_at }));

  (hlp.data ?? []).forEach((h: any) => out.push({ key: `help-${h.id}`, title: h.topic === 'report' ? 'Report from a user' : 'Help message', sub: `"${String(h.body).slice(0, 60)}"`, href: '/admin/help', go: 'Reply', at: h.created_at }));

  const open = (lst.data ?? []) as Listing[];
  if (open.length) {
    const { data: bs } = await db.from('marketplace_bids').select('listing_id,status').in('listing_id', open.map((l) => l.id));
    const has = new Set((bs ?? []).filter((b: any) => b.status !== 'withdrawn').map((b: any) => b.listing_id as string));
    open.filter((l) => !has.has(l.id)).forEach((l) => out.push({ key: `nb-${l.id}`, title: 'No bids after 48 hours', sub: `${listingTitle(l)} · ZIP ${l.zip}`, href: '/admin/marketplace', go: 'View', at: l.created_at }));
  }
  return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()).slice(0, 12);
}

export function ageText(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / D);
  return d <= 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} ago`;
}

export type Health = {
  posted: number; withBid: number; hired: number; noBid: number; bidsAccepted: number;
  avgFirstBidHrs: number | null; bidsPerProject: number;
  waiting: { listing: Listing; coverage: number | null; bids: number }[];
};

/** Marketplace funnel for projects posted in the last `days` days (all time when null). */
export async function health(db: Db, days: number | null): Promise<Health> {
  let q = db.from('marketplace_listings').select('*').order('created_at', { ascending: false }).limit(1000);
  if (days) q = q.gt('created_at', new Date(Date.now() - days * D).toISOString());
  const { data } = await q;
  const ls = (data ?? []) as Listing[];
  const byId = new Map(ls.map((l) => [l.id, l]));
  let bids: any[] = [];
  if (ls.length) {
    const { data: bs } = await db.from('marketplace_bids').select('listing_id,status,created_at').in('listing_id', ls.map((l) => l.id)).limit(5000);
    bids = (bs ?? []).filter((b: any) => b.status !== 'withdrawn');
  }
  const first = new Map<string, number>();
  const count = new Map<string, number>();
  bids.forEach((b) => {
    const t = new Date(b.created_at).getTime();
    if (!first.has(b.listing_id) || t < (first.get(b.listing_id) as number)) first.set(b.listing_id, t);
    count.set(b.listing_id, (count.get(b.listing_id) ?? 0) + 1);
  });
  const gaps = Array.from(first.entries()).map(([id, t]) => t - new Date((byId.get(id) as Listing).created_at).getTime()).filter((g) => g >= 0);
  const withBid = first.size;

  // Open projects still without a bid, with how many contractors cover that trade and place.
  const now = Date.now();
  const waitingLs = ls.filter((l) => l.status === 'open' && new Date(l.expires_at).getTime() > now && !count.has(l.id)).reverse().slice(0, 10);
  const waiting: Health['waiting'] = [];
  if (waitingLs.length) {
    const { data: cos } = await db.from('companies').select('id,trades,business_zip,service_radius_mi');
    const zips = [...waitingLs.map((l) => l.zip), ...(cos ?? []).map((c: any) => c.business_zip).filter(Boolean)];
    const coords = await zipCoords(zips);
    waitingLs.forEach((l) => {
      const at = coords.get(l.zip);
      let n: number | null = null;
      if (at) {
        n = (cos ?? []).filter((c: any) => {
          const trades: string[] = c.trades ?? [];
          if (trades.length && !trades.includes(l.job_type)) return false;
          const me = c.business_zip ? coords.get(c.business_zip) : null;
          return !!me && miles(me, at) <= (c.service_radius_mi ?? DEFAULT_RADIUS);
        }).length;
      }
      waiting.push({ listing: l, coverage: n, bids: 0 });
    });
  }

  return {
    posted: ls.length,
    withBid,
    hired: ls.filter((l) => l.status === 'awarded').length,
    noBid: ls.length - withBid,
    bidsAccepted: bids.filter((b) => b.status === 'won').length,
    avgFirstBidHrs: gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length / H : null,
    bidsPerProject: ls.length ? bids.length / ls.length : 0,
    waiting,
  };
}
