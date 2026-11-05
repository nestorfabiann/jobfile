'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { requireMarketplace, listingOpen, listingTitle } from '@/lib/marketplace';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hasContactInfo } from '@/lib/contactInfo';
import { notifyUsers } from '@/lib/notify';
import { companyOf, memberIds } from '@/lib/team';
import { MAX_QUESTIONS_PER_DAY, makeInvite, tellCompany, type BidInvite } from '@/lib/bidInvites';

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
  const l = await myListing(user.id, txt(formData, 'listing_id', 60));
  if (!l) go(path, 'error', 'Pick one of your projects.');
  const body = txt(formData, 'body', 1000);
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
  const path = `/marketplace/${a.inv.listing_id}/invite/${id}`;
  const db = supabaseAdmin();
  const { data: l } = await db.from('marketplace_listings').select('id,job_type,items,status,expires_at,homeowner_id').eq('id', a.inv.listing_id).maybeSingle<any>();
  if (!l || !listingOpen(l) || a.inv.status === 'declined') go(path, 'error', 'This conversation is closed.');
  const body = txt(formData, 'body', 1000);
  if (!body) go(path, 'error', 'Write a message first.');
  if (hasContactInfo(body)) go(path, 'error', 'Phone numbers, emails and web links are not allowed until a bid is accepted.');
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await db.from('invite_messages').select('id', { count: 'exact', head: true }).eq('invite_id', id).eq('sender_id', user.id).gt('created_at', since);
  if ((count ?? 0) >= 30) go(path, 'error', 'That is a lot of messages for one day. Try again tomorrow.');
  await db.from('invite_messages').insert({ invite_id: id, sender_id: user.id, sender_side: a.side, body });
  const to = a.side === 'homeowner' ? await memberIds(a.inv.company_id) : [a.inv.homeowner_id];
  await notifyUsers({ userIds: to, projectId: null, kind: 'bid', path: a.side === 'homeowner' ? path : path, title: `New message about ${listingTitle(l)}`, body: 'Open the thread to read and reply.', cta: 'Read and reply', throttle: true });
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
  const { data: l } = await db.from('marketplace_listings').select('id,job_type,items').eq('id', a.inv.listing_id).maybeSingle<any>();
  await notifyUsers({ userIds: [a.inv.homeowner_id], projectId: null, kind: 'bid', path: `/marketplace/${a.inv.listing_id}`, title: `${a.me?.name ?? 'A contractor'} passed on ${l ? listingTitle(l) : 'your project'}`, body: 'They cannot take this one. Other contractors can still bid.' });
  revalidatePath(`/marketplace/${a.inv.listing_id}`);
  redirect('/marketplace?ok=' + encodeURIComponent('You passed on that invite.'));
}
