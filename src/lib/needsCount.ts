import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { listingOpen, marketplaceEnabled, type Listing } from '@/lib/marketplace';
import { projectTasks } from '@/lib/needs';

/**
 * How many rows the "Needs you" card on Projects shows for this person (the card lists at most 8).
 * It follows the same rules as src/app/projects/page.tsx, so keep the two in step when a kind of task is added.
 */
export async function needsCount(userId: string): Promise<number> {
  const sb = supabaseServer();
  const [{ data: projects }, { data: memberships }] = await Promise.all([
    sb.from('projects').select('id,name,address,homeowner_name,created_at,closeout_started_at,completed_at,company_id'),
    sb.from('company_members').select('company_id').eq('user_id', userId),
  ]);
  const companyIds = ((memberships ?? []) as { company_id: string }[]).map((m) => m.company_id);
  let n = (await projectTasks(userId, (projects ?? []) as any, companyIds)).length;

  if (marketplaceEnabled()) {
    const db = supabaseAdmin();
    const myBidIds: string[] = [];
    if (!companyIds.length) {
      const { data: ls } = await db.from('marketplace_listings').select('*').eq('homeowner_id', userId).limit(30);
      const posted = (ls ?? []) as Listing[];
      if (posted.length) {
        const { data: bs } = await db.from('marketplace_bids').select('id,listing_id,status,created_at').in('listing_id', posted.map((l) => l.id));
        const fresh = new Set<string>();
        (bs ?? []).forEach((b: any) => {
          if (b.status === 'withdrawn') return;
          myBidIds.push(b.id);
          const l = posted.find((x) => x.id === b.listing_id) as any;
          if (l && 'bids_seen_at' in l && listingOpen(l) && new Date(b.created_at) > new Date(l.bids_seen_at ?? l.created_at)) fresh.add(l.id);
        });
        n += fresh.size;
      }
    } else {
      const { data: mine } = await db.from('marketplace_bids').select('id').eq('company_id', companyIds[0]).eq('status', 'waiting');
      (mine ?? []).forEach((b: any) => myBidIds.push(b.id));
    }
    if (myBidIds.length) {
      const { data: ms } = await db.from('marketplace_messages').select('listing_id').in('bid_id', myBidIds).neq('sender_id', userId).is('read_at', null);
      n += new Set((ms ?? []).map((m: any) => m.listing_id)).size;
    }
  }

  const { data: unread } = await sb
    .from('notifications')
    .select('title,kind')
    .is('read_at', null)
    .in('kind', ['review', 'job_match'])
    .gt('created_at', new Date(Date.now() - 14 * 86400000).toISOString())
    .limit(30);
  const rows = (unread ?? []) as { title: string; kind: string }[];
  n += rows.filter((r) => r.kind === 'review' && /rate your experience/i.test(r.title)).length;
  if (rows.some((r) => r.kind === 'job_match')) n += 1;
  return Math.min(n, 8);
}
