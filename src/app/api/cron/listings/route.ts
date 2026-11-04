import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyUsers, notifyOtherSide } from '@/lib/notify';
import { listingTitle } from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

const DAY = 86400_000;
const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Daily job. Nudges homeowners about marketplace posts (no bids, ending, ended) and reminds whoever must decide on a change order that has waited. Safe to run twice: each notice is sent once. */
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

  // Change orders still waiting for a decision: remind the other side after 3 days, and once more after 7.
  const { data: pending } = await db.from('change_orders').select('id,project_id,number,title,cost_cents,requested_by,requested_role,created_at').eq('status', 'pending').limit(500);
  for (const co of (pending ?? []) as any[]) {
    try {
      const age = now - new Date(co.created_at).getTime();
      const stage = age >= 7 * DAY ? 7 : age >= 3 * DAY ? 3 : 0;
      if (!stage) continue;
      const { data: project } = await db.from('projects').select('name').eq('id', co.project_id).maybeSingle();
      const name = (project?.name as string | undefined) ?? 'your project';
      const title = stage === 3 ? `CO-${co.number} is waiting for your approval on ${name}` : `Reminder: CO-${co.number} has waited 7 days on ${name}`;
      const { count } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('project_id', co.project_id).eq('kind', 'change').eq('title', title);
      if ((count ?? 0) > 0) continue;
      const amount = (co.cost_cents as number) >= 0 ? `+$${Math.round((co.cost_cents as number) / 100).toLocaleString('en-US')}` : `-$${Math.round(-(co.cost_cents as number) / 100).toLocaleString('en-US')}`;
      await notifyOtherSide({
        projectId: co.project_id, senderId: co.requested_by, senderRole: co.requested_role === 'homeowner' ? 'homeowner' : 'contractor', kind: 'change',
        title: () => title, body: `${co.title} (${amount}). Open the project to approve or decline it. Work on a change should not start until it is approved.`,
      });
      sent++;
    } catch { /* keep going */ }
  }
  // Confirmed visits in the next 36 hours: remind both sides once.
  const { data: soonVisits } = await db.from('visits').select('*').eq('status', 'confirmed').is('remind_sent_at', null).gte('scheduled_for', new Date(now).toISOString()).lte('scheduled_for', new Date(now + 36 * 3600 * 1000).toISOString()).limit(200);
  for (const v of (soonVisits ?? []) as any[]) {
    try {
      const when = new Date(v.scheduled_for).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const title = `Reminder: ${v.title} ${when}`;
      if (v.project_id) {
        const zero = '00000000-0000-0000-0000-000000000000';
        for (const r of ['homeowner', 'contractor'] as const) {
          await notifyOtherSide({ projectId: v.project_id, senderId: zero, senderRole: r, kind: 'visit', title: () => title, body: 'Open the Schedule tab for access notes or to reschedule.' });
        }
      } else if (v.bid_id) {
        const { data: bid } = await db.from('marketplace_bids').select('company_id,listing_id').eq('id', v.bid_id).maybeSingle();
        const { data: lst } = bid ? await db.from('marketplace_listings').select('homeowner_id').eq('id', bid.listing_id).maybeSingle() : { data: null };
        const { data: mem } = bid ? await db.from('company_members').select('user_id').eq('company_id', bid.company_id) : { data: [] };
        const path = `/marketplace/${bid?.listing_id}?open=${v.bid_id}#bid-${v.bid_id}`;
        const ids = [lst?.homeowner_id as string | undefined, ...((mem ?? []) as any[]).map((m) => m.user_id as string)].filter(Boolean) as string[];
        if (ids.length) await notifyUsers({ userIds: ids, projectId: null, kind: 'visit', title, body: 'Open the bid to see the details or reschedule.', path, cta: 'Open bid' });
      }
      await db.from('visits').update({ remind_sent_at: new Date().toISOString() }).eq('id', v.id);
      sent++;
    } catch { /* keep going */ }
  }
  return NextResponse.json({ ok: true, checked: (listings ?? []).length, sent });
}
