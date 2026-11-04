import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyUsers } from '@/lib/notify';
import { listingTitle } from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

const DAY = 86400_000;
const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Daily job. Sends homeowners a nudge when a post has no bids, is about to end, or has ended. Safe to run twice: each notice is sent once. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = supabaseAdmin();
  const now = Date.now();
  let sent = 0;

  const once = async (userId: string, kind: string, title: string, body: string, path: string, cta?: string) => {
    const { count } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', kind).eq('title', title);
    if ((count ?? 0) > 0) return;
    await notifyUsers({ userIds: [userId], projectId: null, kind, path, title, body, cta });
    sent++;
  };

  const { data: listings } = await db.from('marketplace_listings').select('*').eq('status', 'open').limit(500);
  for (const l of (listings ?? []) as any[]) {
    try {
      const path = `/marketplace/${l.id}`;
      const name = listingTitle(l);
      const end = new Date(l.expires_at).getTime();
      const left = end - now;
      const { count: waiting } = await db.from('marketplace_bids').select('id', { count: 'exact', head: true }).eq('listing_id', l.id).eq('status', 'waiting');
      const nBids = waiting ?? 0;

      if (left > 0 && nBids === 0 && now - new Date(l.created_at).getTime() >= 3 * DAY) {
        await once(l.homeowner_id, 'listing_nobids', `No bids yet on ${name}`, 'It has been 3 days. Adding photos or a budget range usually helps, or you can invite a contractor you know.', path, 'Open project');
      }
      // The end date is in the title, so extending a post re-arms its reminders.
      if (left > 0 && left <= 3 * DAY) {
        await once(l.homeowner_id, 'listing_ending', `${name} ends in 3 days (${fmt(l.expires_at)})`, `${nBids} bid${nBids === 1 ? '' : 's'} waiting. Keep it open 30 more days, or let it end.`, path, 'Keep it open');
      } else if (left > 3 * DAY && left <= 7 * DAY) {
        await once(l.homeowner_id, 'listing_ending', `${name} ends in 7 days (${fmt(l.expires_at)})`, `${nBids} bid${nBids === 1 ? '' : 's'} waiting. Keep it open 30 more days, or let it end.`, path, 'Keep it open');
      } else if (left <= 0) {
        await once(l.homeowner_id, 'listing_ended', `${name} has ended (${fmt(l.expires_at)})`, nBids > 0 ? `${nBids} bid${nBids === 1 ? ' is' : 's are'} still waiting. Pick one or close the project so contractors are not left hanging.` : 'No bids were waiting. You can post it again any time.', path, 'Open project');
      }
    } catch { /* one bad post must not stop the rest */ }
  }
  return NextResponse.json({ ok: true, checked: (listings ?? []).length, sent });
}
