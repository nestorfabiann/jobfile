'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyUsers } from '@/lib/notify';
import { dollars, parseDollars } from '@/lib/money';
import { listingOpen, listingTitle, MAX_BIDS_PER_DAY, requireMarketplace, type Listing } from '@/lib/marketplace';
import { companyOf, isVerified, localPartners, memberIds, type TeamBid, type TeamPartner } from '@/lib/team';

const txt = (f: FormData, k: string, n: number) => String(f.get(k) ?? '').trim().slice(0, n);
function go(path: string, key: 'error' | 'ok', msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
}
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Once every partner has confirmed, the draft becomes a normal marketplace bid with the combined price. */
async function release(teamBidId: string) {
  const db = supabaseAdmin();
  const { data: tb } = await db.from('team_bids').select('*').eq('id', teamBidId).maybeSingle<TeamBid>();
  if (!tb || tb.status !== 'pending') return;
  const { data: ps } = await db.from('team_partners').select('*').eq('team_bid_id', tb.id);
  const partners = (ps ?? []) as TeamPartner[];
  if (!partners.length || partners.some((p) => p.status !== 'confirmed')) return;
  const { data: l } = await db.from('marketplace_listings').select('*').eq('id', tb.listing_id).maybeSingle<Listing>();
  const { data: lead } = await db.from('companies').select('name').eq('id', tb.lead_company_id).maybeSingle();
  const leadName = (lead?.name as string | undefined) ?? 'A contractor';
  if (!l || !listingOpen(l)) {
    await db.from('team_bids').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', tb.id);
    await notifyUsers({ userIds: [tb.lead_user_id], projectId: null, kind: 'bid', path: '/collaborate', title: 'Your team bid was not sent', body: 'The project is no longer taking bids.' });
    return;
  }
  const total = tb.lead_cents + partners.reduce((n, p) => n + p.price_cents, 0);
  const base = { weeks: tb.weeks, start_date: tb.start_date, note: tb.note, status: 'waiting', updated_at: new Date().toISOString() };
  const { data: pcos } = await db.from('companies').select('id,name').in('id', partners.map((p) => p.company_id));
  const names = [leadName, ...((pcos ?? []) as any[]).map((c) => c.name as string)].join(' and ');

  // Puts one company's bid on the listing, reusing a withdrawn one. Null when that company already has a live bid.
  const putBid = async (companyId: string, bidderId: string, priceCents: number, inclusions: string): Promise<string | null> => {
    const row = { ...base, price_cents: priceCents, inclusions };
    const { data: ex } = await db.from('marketplace_bids').select('id,status').eq('listing_id', l.id).eq('company_id', companyId).maybeSingle();
    if (ex) {
      if (ex.status !== 'withdrawn') return null;
      await db.from('marketplace_bids').update({ ...row, bidder_id: bidderId }).eq('id', ex.id);
      return ex.id as string;
    }
    const { data: ins, error } = await db.from('marketplace_bids').insert({ ...row, listing_id: l.id, company_id: companyId, bidder_id: bidderId }).select('id').single();
    return error || !ins ? null : (ins.id as string);
  };
  const fail = async () => {
    await db.from('team_bids').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', tb.id);
    await notifyUsers({ userIds: [tb.lead_user_id], projectId: null, kind: 'bid', path: '/collaborate', title: 'Your team bid was not sent', body: 'One of the companies already has its own bid on this project. Withdraw it and start the team bid again.' });
  };

  if (tb.structure === 'separate') {
    // Two contracts: each company gets its own bid, and the homeowner sees them together as one team bid.
    const { data: live } = await db.from('marketplace_bids').select('company_id,status').eq('listing_id', l.id).in('company_id', partners.map((p) => p.company_id));
    if ((live ?? []).some((x: any) => x.status !== 'withdrawn')) return fail();
    const leadBid = await putBid(tb.lead_company_id, tb.lead_user_id, tb.lead_cents, tb.inclusions);
    if (!leadBid) return fail();
    for (const p of partners) {
      const members = await memberIds(p.company_id);
      const id = await putBid(p.company_id, p.answered_by ?? members[0] ?? tb.lead_user_id, p.price_cents, p.scope);
      if (id) await db.from('team_partners').update({ bid_id: id }).eq('id', p.id);
    }
    await db.from('team_bids').update({ status: 'sent', bid_id: leadBid, updated_at: new Date().toISOString() }).eq('id', tb.id);
  } else {
    const { data: ex } = await db.from('marketplace_bids').select('id,status').eq('listing_id', l.id).eq('company_id', tb.lead_company_id).maybeSingle();
    if (ex && ex.status !== 'withdrawn') return;
    const bidId = await putBid(tb.lead_company_id, tb.lead_user_id, total, tb.inclusions);
    if (!bidId) return;
    await db.from('team_bids').update({ status: 'sent', bid_id: bidId, updated_at: new Date().toISOString() }).eq('id', tb.id);
  }
  await notifyUsers({ userIds: [l.homeowner_id], projectId: null, kind: 'bid', path: `/marketplace/${l.id}`, title: `New team bid on ${listingTitle(l)}: ${dollars(total)}`, body: `${names} bid together for ${dollars(total)}${tb.structure === 'separate' ? ', as separate contracts' : ''}. Open Marketplace to see each part.` });
  await notifyUsers({ userIds: [tb.lead_user_id], projectId: null, kind: 'bid', path: `/marketplace/${l.id}`, title: `Your team bid was sent: ${dollars(total)}`, body: 'Your partner confirmed. The homeowner can see the team bid now.' });
  revalidatePath(`/marketplace/${l.id}`);
  revalidatePath('/marketplace/bids');
}

// ---------- Lead: build ----------

export async function createTeamBid(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const listingId = String(formData.get('listing_id') ?? '');
  const path = `/marketplace/${listingId}/team`;
  const db = supabaseAdmin();
  const { data: l } = await db.from('marketplace_listings').select('*').eq('id', listingId).maybeSingle<Listing>();
  if (!l) redirect('/marketplace');
  const me = await companyOf(user.id);
  if (!me) go(path, 'error', 'Set up your company on the Projects page before bidding.');
  if (l.homeowner_id === user.id) go(path, 'error', 'You cannot bid on your own project.');
  if (!listingOpen(l)) go(path, 'error', 'This project is no longer taking bids.');
  const { data: hc } = await db.from('companies').select('hidden_at').eq('id', me.id).maybeSingle<any>();
  if (hc?.hidden_at) go(path, 'error', 'Your business is hidden from the marketplace right now, so you cannot place new bids. Contact Jobfile for help.');
  if (!(await isVerified(me.id))) go(path, 'error', 'Your company needs to be verified by Jobfile before it can lead a team bid.');

  const partnerId = String(formData.get('partner_id') ?? '');
  if (!partnerId || partnerId === me.id) go(path, 'error', 'Pick the company you want to team up with.');
  const { data: pco } = await db.from('companies').select('id,name').eq('id', partnerId).maybeSingle();
  if (!pco) go(path, 'error', 'We could not find that company.');
  if (!(await isVerified(partnerId))) go(path, 'error', 'That company is not verified by Jobfile yet, so it cannot join a team bid.');
  if (!(await localPartners(l.zip, me!.id, { ids: [partnerId] })).length) go(path, 'error', 'Team bids are for local companies. That company is outside the area for this project.');

  const lead = parseDollars(txt(formData, 'price', 20));
  const part = parseDollars(txt(formData, 'partner_price', 20));
  if (lead < 100_00 || lead > 10_000_000_00) go(path, 'error', 'Enter your price in dollars (for example 2200).');
  if (part < 100_00 || part > 10_000_000_00) go(path, 'error', "Enter your partner's price in dollars (for example 650).");
  const scope = txt(formData, 'partner_scope', 300);
  if (!scope) go(path, 'error', "Say what your partner's part of the job is.");
  const wk = parseInt(txt(formData, 'weeks', 4), 10);
  const weeks = Number.isFinite(wk) && wk >= 1 && wk <= 520 ? wk : null;
  const sd = txt(formData, 'start_date', 10);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(sd) && sd >= todayIso() ? sd : null;
  const structure = String(formData.get('structure') ?? '') === 'separate' ? 'separate' : 'lead';
  const hireMode = structure === 'separate' && String(formData.get('hire_mode') ?? '') === 'package' ? 'package' : 'either';
  if (structure === 'separate') {
    const { data: theirs } = await db.from('marketplace_bids').select('status').eq('listing_id', l.id).eq('company_id', partnerId).maybeSingle();
    if (theirs && theirs.status !== 'withdrawn') go(path, 'error', 'That company already has its own bid on this project, so it cannot be part of a separate-contracts team bid.');
  }

  const { data: solo } = await db.from('marketplace_bids').select('id,status').eq('listing_id', l.id).eq('company_id', me.id).maybeSingle();
  if (solo && solo.status !== 'withdrawn') go(path, 'error', 'You already have a bid on this project. Withdraw it first to bid as a team.');
  const { data: old } = await db.from('team_bids').select('id,status').eq('listing_id', l.id).eq('lead_company_id', me.id).maybeSingle();
  if (old && old.status !== 'canceled') go(path, 'error', 'You already have a team bid on this project. Open Collaborate to see it.');
  if (!old) {
    const { count } = await db.from('team_bids').select('id', { count: 'exact', head: true }).eq('lead_user_id', user.id).gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    if ((count ?? 0) >= MAX_BIDS_PER_DAY) go(path, 'error', 'You have started a lot of team bids today. Try again tomorrow.');
  }

  const fields = { structure, hire_mode: hireMode, schedule_note: txt(formData, 'schedule_note', 200), lead_user_id: user.id, lead_cents: lead, weeks, start_date: start, inclusions: txt(formData, 'inclusions', 500), note: txt(formData, 'note', 1000), status: 'pending', bid_id: null, updated_at: new Date().toISOString() };
  let tbId: string;
  if (old) {
    await db.from('team_bids').update(fields).eq('id', old.id);
    await db.from('team_partners').delete().eq('team_bid_id', old.id);
    tbId = old.id as string;
  } else {
    const { data: ins, error } = await db.from('team_bids').insert({ ...fields, listing_id: l.id, lead_company_id: me.id }).select('id').single();
    if (error || !ins) go(path, 'error', 'Could not save your team bid. Check that the database step was run.');
    tbId = ins.id as string;
  }
  const { data: pr, error: pe } = await db.from('team_partners').insert({ team_bid_id: tbId, company_id: partnerId, scope, price_cents: part }).select('id').single();
  if (pe || !pr) go(path, 'error', 'Could not invite that company. Try again.');

  await notifyUsers({ userIds: await memberIds(partnerId), projectId: null, kind: 'bid', path: `/collaborate/${pr.id}`, title: `${me.name} invited you to a team bid`, body: `${listingTitle(l)}. Your part: ${scope} for ${dollars(part)}.${structure === 'separate' ? ' Separate contracts: the homeowner would hire and pay you directly.' : ''} Open Collaborate to confirm, change your price or decline.`, cta: 'Review the invite' });
  revalidatePath('/collaborate');
  go('/collaborate', 'ok', `Invite sent to ${pco.name}. Your bid goes to the homeowner when they confirm.`);
}

export async function cancelTeamBid(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const id = String(formData.get('team_bid_id') ?? '');
  const db = supabaseAdmin();
  const { data: tb } = await db.from('team_bids').select('*').eq('id', id).maybeSingle<TeamBid>();
  if (!tb || tb.lead_user_id !== user.id || tb.status !== 'pending') redirect('/collaborate');
  await db.from('team_bids').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', tb.id);
  const { data: ps } = await db.from('team_partners').select('company_id').eq('team_bid_id', tb.id);
  const me = await companyOf(user.id);
  for (const p of (ps ?? []) as any[]) {
    await notifyUsers({ userIds: await memberIds(p.company_id as string), projectId: null, kind: 'bid', path: '/collaborate', title: `${me?.name ?? 'A contractor'} canceled a team bid`, body: 'The invite is closed. No action needed.' });
  }
  revalidatePath('/collaborate');
  go('/collaborate', 'ok', 'Team bid canceled.');
}

/** The lead agrees to the new price the partner proposed, and the bid goes out. */
export async function acceptCounter(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const id = String(formData.get('partner_row_id') ?? '');
  const db = supabaseAdmin();
  const { data: p } = await db.from('team_partners').select('*').eq('id', id).maybeSingle<TeamPartner>();
  if (!p) redirect('/collaborate');
  const { data: tb } = await db.from('team_bids').select('*').eq('id', p.team_bid_id).maybeSingle<TeamBid>();
  if (!tb || tb.lead_user_id !== user.id || tb.status !== 'pending' || p.status !== 'countered' || !p.counter_cents) redirect('/collaborate');
  await db.from('team_partners').update({ price_cents: p.counter_cents, counter_cents: null, status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', p.id);
  await release(tb.id);
  revalidatePath('/collaborate');
  go('/collaborate', 'ok', 'New price accepted. Your team bid was sent to the homeowner.');
}

// ---------- Partner: answer ----------

async function loadMine(formData: FormData) {
  const { user } = await requireUser();
  const id = String(formData.get('partner_row_id') ?? '');
  const db = supabaseAdmin();
  const { data: p } = await db.from('team_partners').select('*').eq('id', id).maybeSingle<TeamPartner>();
  const me = await companyOf(user.id);
  if (!p || !me || me.id !== p.company_id) redirect('/collaborate');
  const { data: tb } = await db.from('team_bids').select('*').eq('id', p.team_bid_id).maybeSingle<TeamBid>();
  if (!tb || tb.status !== 'pending') go('/collaborate', 'error', 'This invite is closed.');
  return { db, p, tb, me, user, path: `/collaborate/${p.id}` };
}

export async function confirmPartner(formData: FormData) {
  requireMarketplace();
  const { db, p, tb, me, user, path } = await loadMine(formData);
  if (p.status !== 'invited') go(path, 'error', 'You already answered this invite.');
  await db.from('team_partners').update({ status: 'confirmed', answered_by: user.id, updated_at: new Date().toISOString() }).eq('id', p.id);
  await notifyUsers({ userIds: [tb.lead_user_id], projectId: null, kind: 'bid', path: '/collaborate', title: `${me!.name} confirmed their part`, body: `Confirmed at ${dollars(p.price_cents)}. Your team bid goes to the homeowner now.` });
  await release(tb.id);
  revalidatePath('/collaborate');
  go('/collaborate', 'ok', 'Confirmed. The team bid was sent to the homeowner.');
}

export async function counterPartner(formData: FormData) {
  requireMarketplace();
  const { db, p, tb, me, user, path } = await loadMine(formData);
  if (p.status !== 'invited') go(path, 'error', 'You already answered this invite.');
  const price = parseDollars(txt(formData, 'price', 20));
  if (price < 100_00 || price > 10_000_000_00) go(path, 'error', 'Enter your price in dollars (for example 700).');
  if (price === p.price_cents) go(path, 'error', 'That is the same price. Tap Confirm instead.');
  await db.from('team_partners').update({ status: 'countered', counter_cents: price, answered_by: user.id, updated_at: new Date().toISOString() }).eq('id', p.id);
  await notifyUsers({ userIds: [tb.lead_user_id], projectId: null, kind: 'bid', path: '/collaborate', title: `${me!.name} proposed a new price`, body: `${dollars(price)} instead of ${dollars(p.price_cents)}. Open Collaborate to accept it and send the bid.`, cta: 'Review the price' });
  revalidatePath('/collaborate');
  go('/collaborate', 'ok', 'Sent. The lead will accept your new price or reply.');
}

export async function declinePartner(formData: FormData) {
  requireMarketplace();
  const { db, p, tb, me } = await loadMine(formData);
  await db.from('team_partners').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', p.id);
  await notifyUsers({ userIds: [tb.lead_user_id], projectId: null, kind: 'bid', path: '/collaborate', title: `${me!.name} declined the team bid`, body: 'You can cancel it and invite someone else from the project page.' });
  revalidatePath('/collaborate');
  go('/collaborate', 'ok', 'Invite declined.');
}

// ---------- Open to partnering ----------

export async function setOpenToPartner(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const me = await companyOf(user.id);
  if (!me) redirect('/collaborate');
  const on = String(formData.get('on') ?? '') === '1';
  try { await supabaseAdmin().from('companies').update({ open_to_partner: on }).eq('id', me!.id); } catch { /* column missing until the SQL step is run */ }
  revalidatePath('/collaborate');
  revalidatePath(`/contractors/${me!.id}`);
  redirect('/collaborate');
}
