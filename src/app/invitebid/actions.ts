'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { requireMarketplace, listingOpen, listingTitle } from '@/lib/marketplace';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hasContactInfo } from '@/lib/contactInfo';
import { notifyUsers } from '@/lib/notify';
import { companyOf, memberIds } from '@/lib/team';
import { MAX_QUESTIONS_PER_DAY, makeGeneral, makeInvite, tellCompany, type BidInvite } from '@/lib/bidInvites';

const txt = (f: FormData, k: string, n: number) => String(f.get(k) ?? '').trim().slice(0, n);
function go(path: string, key: 'error' | 'ok', msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
}
const firstName = (n: string) => (n.trim().split(/\s+/)[0] || 'A homeowner').slice(0, 40);

async function myListing(userId: string, id: string) {
  const db = supabaseAdmin();
  const { data: l } = await db.from('marketplace_listings').select('id,homeowner_id,job_type,items,zip,status,expires_at,homeowner_name').eq('id', id).maybeSingle<any>();
  return l && l.homeowner_id === userId ? l : null;
}

export async function sendBidInvite(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const companyId = txt(formData, 'company_id', 60);
  const path = `/contractors/${companyId}/invite`;
  if (await companyOf(user.id)) go(`/contractors/${companyId}`, 'error', 'Contractors bid on projects. Homeowners invite them.');
  const l = await myListing(user.id, txt(formData, 'listing_id', 60));
  if (!l) go(path, 'error', 'Pick one of your projects.');
  const note = txt(formData, 'note', 300);
  if (note && hasContactInfo(note)) go(path, 'error', 'Phone numbers, emails and web links are not allowed until a bid is accepted.');
  const r = await makeInvite(l, companyId, note, 'invited');
  if ('error' in r) go(path, 'error', r.error);
  await tellCompany(companyId, l, `${firstName(l.homeowner_name ?? '')} invited you to bid on ${listingTitle(l)}`, `${listingTitle(l)} in ${l.zip}.${note ? `\n\n"${note}"` : ''}\n\nOpen the project to see the details and bid. You can also ask a question or pass.`);
  revalidatePath(`/marketplace/${l.id}`);
  go(`/contractors/${companyId}`, 'ok', 'Invite sent. They will see your project and can bid.');
}

export async function askContractor(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const companyId = txt(formData, 'company_id', 60);
  const path = `/contractors/${companyId}/ask`;
  if (await companyOf(user.id)) go(`/contractors/${companyId}`, 'error', 'Contractors bid on projects. Homeowners ask questions.');
  const pick = txt(formData, 'listing_id', 60);
  const body0 = txt(formData, 'body', 1000);
  if (pick === 'general') {
    if (!body0) go(path, 'error', 'Write your question first.');
    if (hasContactInfo(body0)) go(path, 'error', 'Phone numbers, emails and web links are not allowed until a bid is accepted. Ask your question here instead.');
    const g = await makeGeneral(user.id, companyId);
    if ('error' in g) go(path, 'error', g.error);
    const gdb = supabaseAdmin();
    const { data: prior } = await gdb.from('invite_messages').select('sender_side').eq('invite_id', g.id);
    const sent = ((prior ?? []) as any[]);
    if (sent.some((m) => m.sender_side === 'homeowner') && !sent.some((m) => m.sender_side === 'contractor')) go(`/marketplace/general/invite/${g.id}`, 'error', 'You already asked. They will see it and can reply.');
    await gdb.from('invite_messages').insert({ invite_id: g.id, sender_id: user.id, sender_side: 'homeowner', body: body0 });
    await gdb.from('bid_invites').update({ updated_at: new Date().toISOString() }).eq('id', g.id);
    await tellCompany(companyId, { id: '', job_type: '', items: [] }, 'A homeowner asked you a question', `"${body0.slice(0, 200)}"\n\nIt is a general question, not a bid request. Open the thread to reply.`, `/marketplace/general/invite/${g.id}`);
    go(`/marketplace/general/invite/${g.id}`, 'ok', 'Question sent.');
  }
  const l = await myListing(user.id, pick);
  if (!l) go(path, 'error', 'Pick one of your projects, or ask a general question.');
  const body = body0;
  if (!body) go(path, 'error', 'Write your question first.');
  if (hasContactInfo(body)) go(path, 'error', 'Phone numbers, emails and web links are not allowed until a bid is accepted. Ask your question here instead.');
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 86400000).toISOString();
  const { data: mine } = await db.from('bid_invites').select('id').eq('homeowner_id', user.id);
  const myIds = ((mine ?? []) as any[]).map((m) => m.id as string);
  if (myIds.length) {
    const { count } = await db.from('invite_messages').select('id', { count: 'exact', head: true }).in('invite_id', myIds).eq('sender_side', 'homeowner').gt('created_at', since);
    if ((count ?? 0) >= MAX_QUESTIONS_PER_DAY) go(path, 'error', `You can send ${MAX_QUESTIONS_PER_DAY} questions a day. Try again tomorrow.`);
  }
  const r = await makeInvite(l, companyId, '', 'asked');
  if ('error' in r) go(path, 'error', r.error);
  await db.from('invite_messages').insert({ invite_id: r.id, sender_id: user.id, sender_side: 'homeowner', body });
  await tellCompany(companyId, l, `A homeowner asked about ${listingTitle(l)}`, `"${body.slice(0, 200)}"\n\nOpen the thread to reply.`, `/marketplace/${l.id}/invite/${r.id}`);
  go(`/marketplace/${l.id}/invite/${r.id}`, 'ok', 'Question sent.');
}

async function access(userId: string, inviteId: string) {
  const db = supabaseAdmin();
  const { data: inv } = await db.from('bid_invites').select('*').eq('id', inviteId).maybeSingle<BidInvite>();
  if (!inv) return null;
  if (inv.homeowner_id === userId) return { inv, side: 'homeowner' as const };
  const me = await companyOf(userId);
  if (me && me.id === inv.company_id) return { inv, side: 'contractor' as const, me };
  return null;
}

export async function replyInvite(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const id = txt(formData, 'id', 60);
  const a = await access(user.id, id);
  if (!a) redirect('/projects');
  const lid = a.inv.listing_id;
  const path = `/marketplace/${lid ?? 'general'}/invite/${id}`;
  const db = supabaseAdmin();
  let l: any = null;
  if (lid) ({ data: l } = await db.from('marketplace_listings').select('id,job_type,items,status,expires_at,homeowner_id').eq('id', lid).maybeSingle<any>());
  if ((lid && (!l || !listingOpen(l))) || a.inv.status === 'declined') go(path, 'error', 'This conversation is closed.');
  const body = txt(formData, 'body', 1000);
  if (!body) go(path, 'error', 'Write a message first.');
  if (hasContactInfo(body)) go(path, 'error', 'Phone numbers, emails and web links are not allowed until a bid is accepted.');
  if (!lid && a.side === 'homeowner') {
    const { data: prior } = await db.from('invite_messages').select('sender_side').eq('invite_id', id);
    const ps = (prior ?? []) as any[];
    if (ps.some((m) => m.sender_side === 'homeowner') && !ps.some((m) => m.sender_side === 'contractor')) go(path, 'error', 'You already asked. They will see it and can reply.');
  }
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await db.from('invite_messages').select('id', { count: 'exact', head: true }).eq('invite_id', id).eq('sender_id', user.id).gt('created_at', since);
  if ((count ?? 0) >= 30) go(path, 'error', 'That is a lot of messages for one day. Try again tomorrow.');
  await db.from('invite_messages').insert({ invite_id: id, sender_id: user.id, sender_side: a.side, body });
  const to = a.side === 'homeowner' ? await memberIds(a.inv.company_id) : [a.inv.homeowner_id];
  await notifyUsers({ userIds: to, projectId: null, kind: 'bid', path: a.side === 'homeowner' ? path : path, title: l ? `New message about ${listingTitle(l)}` : 'New message about your question', body: 'Open the thread to read and reply.', cta: 'Read and reply', throttle: true });
  revalidatePath(path);
  redirect(`${path}#messages`);
}

export async function declineInvite(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const id = txt(formData, 'id', 60);
  const a = await access(user.id, id);
  if (!a || a.side !== 'contractor') redirect('/projects');
  const db = supabaseAdmin();
  await db.from('bid_invites').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', id);
  const { data: l } = a.inv.listing_id ? await db.from('marketplace_listings').select('id,job_type,items').eq('id', a.inv.listing_id).maybeSingle<any>() : { data: null as any };
  await notifyUsers({ userIds: [a.inv.homeowner_id], projectId: null, kind: 'bid', path: a.inv.listing_id ? `/marketplace/${a.inv.listing_id}` : '/find', title: `${a.me?.name ?? 'A contractor'} passed on ${l ? listingTitle(l) : 'your question'}`, body: 'They cannot take this one. Other contractors can still help.' });
  if (a.inv.listing_id) revalidatePath(`/marketplace/${a.inv.listing_id}`);
  redirect('/marketplace?ok=' + encodeURIComponent('You passed on that invite.'));
}

/** The contractor nudges a homeowner to post a project so a bid is possible. */
export async function suggestPost(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const id = txt(formData, 'id', 60);
  const a = await access(user.id, id);
  if (!a || a.side !== 'contractor') redirect('/projects');
  const path = `/marketplace/${a.inv.listing_id ?? 'general'}/invite/${id}`;
  if (a.inv.status === 'declined') go(path, 'error', 'This conversation is closed.');
  const db = supabaseAdmin();
  const body = 'To get a bid from me, post your project on Jobfile (it takes about 3 minutes) and I can send you a price.';
  const { data: dup } = await db.from('invite_messages').select('id').eq('invite_id', id).eq('sender_side', 'contractor').eq('body', body).limit(1);
  if ((dup ?? []).length) go(path, 'ok', 'You already suggested that.');
  await db.from('invite_messages').insert({ invite_id: id, sender_id: user.id, sender_side: 'contractor', body });
  await notifyUsers({ userIds: [a.inv.homeowner_id], projectId: null, kind: 'bid', path, title: `${a.me?.name ?? 'A contractor'} replied to your question`, body: 'They suggest posting your project so they can send a bid.', throttle: true });
  revalidatePath(path);
  go(path, 'ok', 'Sent.');
}
