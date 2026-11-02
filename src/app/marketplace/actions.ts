'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { alertMatchingContractors } from '@/lib/matching';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyUsers } from '@/lib/notify';
import { dollars, parseDollars } from '@/lib/money';
import {
  AI_DAILY_LIMIT, cleanItems, inputHash, JOB_TYPES, listingOpen, listingTitle, MAX_BIDS_PER_DAY, MAX_LISTINGS_PER_DAY, MAX_OPEN_LISTINGS,
  requireMarketplace, scopeText, type Bid, type Listing,
} from '@/lib/marketplace';
import { aiConfigured, makeReference, type Reference } from '@/lib/marketplaceAI';

const IMG: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const txt = (f: FormData, k: string, n: number) => String(f.get(k) ?? '').trim().slice(0, n);
function back(path: string, msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`);
}
const todayIso = () => new Date().toISOString().slice(0, 10);

async function myCompany(userId: string) {
  const db = supabaseAdmin();
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', userId).limit(1);
  const companyId = (mem ?? [])[0]?.company_id as string | undefined;
  if (!companyId) return null;
  const { data: co } = await db.from('companies').select('name').eq('id', companyId).maybeSingle();
  return { companyId, name: (co?.name as string | undefined) ?? 'A contractor' };
}

async function loadListing(id: string) {
  const { data } = await supabaseAdmin().from('marketplace_listings').select('*').eq('id', id).maybeSingle<Listing>();
  return data;
}

// ---------- Homeowner: post ----------

export type RefResult = { ok: true; id: string; ref: Reference } | { ok: false; error: string };

export async function getReference(input: { jobType: string; items: string[]; size: number | null; zip: string; details: string }): Promise<RefResult> {
  requireMarketplace();
  const { user } = await requireUser();
  if (!aiConfigured()) return { ok: false, error: 'The AI cost reference is not available yet. You can still post your project.' };
  const jobType = String(input.jobType ?? '');
  const picked = cleanItems(jobType, Array.isArray(input.items) ? input.items.map(String) : []);
  if (!picked.length) return { ok: false, error: 'Pick at least one item first.' };
  const zip = String(input.zip ?? '').trim();
  if (!/^\d{5}$/.test(zip)) return { ok: false, error: 'Enter a 5-digit ZIP code.' };
  const size = Number.isFinite(Number(input.size)) && Number(input.size) > 0 ? Math.min(1_000_000, Math.round(Number(input.size))) : null;
  const details = String(input.details ?? '').trim().slice(0, 1000);

  const db = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await db.from('marketplace_ai_calls').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gt('created_at', since);
  if ((count ?? 0) >= AI_DAILY_LIMIT) return { ok: false, error: 'You have used today’s cost references. Try again tomorrow, or post without one.' };

  const r = await makeReference({ jobType, items: picked, size, zip, city: '', details });
  if (!r.ok) return r;
  const hash = inputHash(jobType, picked.map((p) => p.item), size, zip, details);
  const { data: row } = await db.from('marketplace_ai_calls').insert({ user_id: user.id, input_hash: hash, result: r.ref }).select('id').single();
  if (!row) return { ok: false, error: 'Could not save the reference. Try again.' };
  return { ok: true, id: row.id as string, ref: r.ref };
}

export async function publishListing(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  if (await myCompany(user.id)) back('/marketplace', 'Contractors bid on projects. Homeowners post them.');

  const jobType = txt(formData, 'job_type', 60);
  if (!JOB_TYPES[jobType]) back('/marketplace/new', 'Choose a job type.');
  const picked = cleanItems(jobType, formData.getAll('items').map(String));
  if (!picked.length) back('/marketplace/new', 'Pick at least one item for your scope.');
  const zip = txt(formData, 'zip', 5);
  if (!/^\d{5}$/.test(zip)) back('/marketplace/new', 'Enter a 5-digit ZIP code.');
  const sizeN = parseInt(txt(formData, 'size', 10).replace(/\D/g, ''), 10);
  const size = Number.isFinite(sizeN) && sizeN > 0 ? Math.min(1_000_000, sizeN) : null;
  const details = txt(formData, 'details', 1000);
  let bmin: number | null = parseDollars(txt(formData, 'budget_min', 20)) || null;
  let bmax: number | null = parseDollars(txt(formData, 'budget_max', 20)) || null;
  if (bmin && bmax && bmin > bmax) [bmin, bmax] = [bmax, bmin];

  const { count: open } = await db.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('homeowner_id', user.id).eq('status', 'open').gt('expires_at', new Date().toISOString());
  if ((open ?? 0) >= MAX_OPEN_LISTINGS) back('/marketplace/new', `You have ${MAX_OPEN_LISTINGS} open projects. Close one first.`);
  const { count: recent } = await db.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('homeowner_id', user.id).gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((recent ?? 0) >= MAX_LISTINGS_PER_DAY) back('/marketplace/new', 'You posted a lot today. Try again tomorrow.');

  // A reference counts only if this server made it for exactly this scope.
  let ref: Reference | null = null;
  const refId = txt(formData, 'ref_id', 40);
  if (refId) {
    const { data: call } = await db.from('marketplace_ai_calls').select('input_hash,result,created_at').eq('id', refId).eq('user_id', user.id).maybeSingle();
    const fresh = call && Date.now() - new Date(call.created_at as string).getTime() < 3 * 3600_000;
    if (fresh && call.input_hash === inputHash(jobType, picked.map((p) => p.item), size, zip, details)) ref = call.result as Reference;
  }

  const { data: prof } = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const { data: l, error } = await db.from('marketplace_listings').insert({
    homeowner_id: user.id,
    homeowner_name: ((prof?.full_name as string | undefined) ?? '').trim().slice(0, 120),
    job_type: jobType,
    items: picked.map((p) => p.item),
    details,
    size_sqft: size,
    zip,
    city: txt(formData, 'city', 80),
    address: txt(formData, 'address', 200),
    is_homestead: formData.get('is_homestead') === 'on',
    budget_min_cents: bmin,
    budget_max_cents: bmax,
    ...(ref ? { ai_low_cents: ref.low * 100, ai_high_cents: ref.high * 100, ai_likely_cents: ref.likely * 100, ai_confidence: ref.confidence, ai_breakdown: ref.breakdown, ai_notes: ref.notes } : {}),
  }).select('id,homeowner_id,job_type,zip,city,items,ai_low_cents,ai_high_cents').single();
  if (error || !l) back('/marketplace/new', 'Could not post the project. Check that the database step was run.');
  await alertMatchingContractors(l as any);
  revalidatePath('/marketplace');
  redirect(`/marketplace/${l.id}?posted=1`);
}

export type UploadResult = { ok: true } | { ok: false; error: string };

export async function uploadListingPhoto(formData: FormData): Promise<UploadResult> {
  try {
    requireMarketplace();
    const { user } = await requireUser();
    const l = await loadListing(String(formData.get('listing_id') ?? ''));
    if (!l || l.homeowner_id !== user.id) return { ok: false, error: 'Not allowed.' };
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'No photo was received.' };
    const ext = IMG[file.type];
    if (!ext) return { ok: false, error: 'Photos must be JPEG, PNG or WebP.' };
    if (file.size > 3_800_000) return { ok: false, error: 'That photo is too large.' };
    const db = supabaseAdmin();
    const { count } = await db.from('marketplace_photos').select('id', { count: 'exact', head: true }).eq('listing_id', l.id);
    if ((count ?? 0) >= 12) return { ok: false, error: 'You can add up to 12 photos.' };
    const path = `${l.id}/${randomUUID()}.${ext}`;
    const up = await db.storage.from('listing-photos').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (up.error) return { ok: false, error: 'Could not store the photo. Check that the database step was run.' };
    const { error } = await db.from('marketplace_photos').insert({ listing_id: l.id, path });
    if (error) {
      await db.storage.from('listing-photos').remove([path]);
      return { ok: false, error: 'Could not save the photo record.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong saving that photo.' };
  }
}

export async function deleteListingPhoto(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const listingId = String(formData.get('listing_id') ?? '');
  const l = await loadListing(listingId);
  if (!l || l.homeowner_id !== user.id) redirect('/marketplace');
  const db = supabaseAdmin();
  const { data: ph } = await db.from('marketplace_photos').select('path').eq('id', String(formData.get('id') ?? '')).eq('listing_id', l.id).maybeSingle();
  if (ph) {
    await db.storage.from('listing-photos').remove([ph.path as string]);
    await db.from('marketplace_photos').delete().eq('id', String(formData.get('id'))).eq('listing_id', l.id);
  }
  redirect(`/marketplace/${l.id}`);
}

export async function closeListing(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const l = await loadListing(String(formData.get('listing_id') ?? ''));
  if (!l || l.homeowner_id !== user.id) redirect('/marketplace');
  const db = supabaseAdmin();
  const { data: done } = await db.from('marketplace_listings').update({ status: 'closed' }).eq('id', l.id).eq('status', 'open').select('id');
  if ((done ?? []).length) {
    const { data: bids } = await db.from('marketplace_bids').update({ status: 'not_selected', updated_at: new Date().toISOString() }).eq('listing_id', l.id).eq('status', 'waiting').select('bidder_id');
    await notifyUsers({ userIds: Array.from(new Set((bids ?? []).map((b) => b.bidder_id as string))), projectId: null, kind: 'bid', path: '/marketplace/bids', title: `${listingTitle(l)} was closed`, body: 'The homeowner closed this project, so it is no longer taking bids.' });
  }
  revalidatePath('/marketplace');
  redirect('/marketplace');
}

// ---------- Contractor: bid ----------

export async function placeBid(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const id = String(formData.get('listing_id') ?? '');
  const path = `/marketplace/${id}`;
  const l = await loadListing(id);
  if (!l) redirect('/marketplace');
  const co = await myCompany(user.id);
  if (!co) back(path, 'Set up your company on the Projects page before bidding.');
  if (l.homeowner_id === user.id) back(path, 'You cannot bid on your own project.');
  if (!listingOpen(l)) back(path, 'This project is no longer taking bids.');

  const price = parseDollars(txt(formData, 'price', 20));
  if (price < 100_00 || price > 10_000_000_00) back(path, 'Enter your price in dollars (for example 31400).');
  const wk = parseInt(txt(formData, 'weeks', 4), 10);
  const weeks = Number.isFinite(wk) && wk >= 1 && wk <= 520 ? wk : null;
  const sd = txt(formData, 'start_date', 10);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(sd) && sd >= todayIso() ? sd : null;

  const db = supabaseAdmin();
  const { data: existing } = await db.from('marketplace_bids').select('id,status').eq('listing_id', l.id).eq('company_id', co.companyId).maybeSingle();
  if (existing && (existing.status === 'won' || existing.status === 'not_selected')) back(path, 'Your bid on this project is closed.');
  if (!existing) {
    const { count } = await db.from('marketplace_bids').select('id', { count: 'exact', head: true }).eq('bidder_id', user.id).gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    if ((count ?? 0) >= MAX_BIDS_PER_DAY) back(path, 'You have placed a lot of bids today. Try again tomorrow.');
  }
  const row = { price_cents: price, weeks, start_date: start, inclusions: txt(formData, 'inclusions', 500), note: txt(formData, 'note', 1000), status: 'waiting', updated_at: new Date().toISOString() };
  if (existing) {
    await db.from('marketplace_bids').update({ ...row, bidder_id: user.id }).eq('id', existing.id);
  } else {
    const { error } = await db.from('marketplace_bids').insert({ ...row, listing_id: l.id, company_id: co.companyId, bidder_id: user.id });
    if (error) back(path, 'Could not save your bid. Check that the database step was run.');
  }
  if (!existing || existing.status === 'withdrawn') {
    await notifyUsers({ userIds: [l.homeowner_id], projectId: null, kind: 'bid', path: `/marketplace/${l.id}`, title: `New bid on ${listingTitle(l)}: ${dollars(price)}`, body: `${co.name} bid ${dollars(price)}. Open Marketplace to compare your bids.` });
  }
  revalidatePath(path);
  revalidatePath('/marketplace/bids');
  redirect(`${path}?bid=1`);
}

export async function withdrawBid(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const co = await myCompany(user.id);
  const listingId = String(formData.get('listing_id') ?? '');
  if (!co) {
    redirect('/marketplace');
    return;
  }
  await supabaseAdmin().from('marketplace_bids').update({ status: 'withdrawn', updated_at: new Date().toISOString() }).eq('listing_id', listingId).eq('company_id', co.companyId).eq('status', 'waiting');
  revalidatePath('/marketplace/bids');
  redirect('/marketplace/bids');
}

// ---------- Homeowner: accept ----------

export async function acceptBid(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const bidId = String(formData.get('bid_id') ?? '');
  const db = supabaseAdmin();
  const { data: bid } = await db.from('marketplace_bids').select('*').eq('id', bidId).maybeSingle<Bid>();
  if (!bid) redirect('/marketplace');
  const l = await loadListing(bid.listing_id);
  if (!l || l.homeowner_id !== user.id) redirect('/marketplace');
  const path = `/marketplace/${l.id}`;
  if (bid.status !== 'waiting' || !listingOpen(l)) back(path, 'This bid can no longer be accepted.');

  // Claim the listing first, so two taps cannot award it twice.
  const { data: claimed } = await db.from('marketplace_listings').update({ status: 'awarded', awarded_bid_id: bid.id }).eq('id', l.id).eq('status', 'open').gt('expires_at', new Date().toISOString()).select('id');
  if (!(claimed ?? []).length) back(path, 'This project was already awarded or closed.');
  const undo = async () => {
    await db.from('marketplace_listings').update({ status: 'open', awarded_bid_id: null }).eq('id', l.id);
  };

  const { data: hp } = await db.from('profiles').select('email').eq('id', user.id).maybeSingle();
  const title = l.job_type;
  const { data: project, error } = await db.from('projects').insert({
    company_id: bid.company_id,
    name: title,
    address: l.address || [l.city, `TX ${l.zip}`].filter(Boolean).join(' '),
    homeowner_name: l.homeowner_name,
    homeowner_email: ((hp?.email as string | undefined) ?? '').toLowerCase(),
    is_homestead: l.is_homestead,
    created_by: bid.bidder_id,
  }).select('id').single();
  if (error || !project) {
    await undo();
    back(path, 'Could not open the project. Try again.');
  }

  await db.from('project_members').insert([
    { project_id: project.id, user_id: bid.bidder_id, role: 'contractor' },
    { project_id: project.id, user_id: user.id, role: 'homeowner' },
  ]);

  // Prefill the agreement draft: scope and price from the post and the bid. The contractor reviews and sends it.
  const scope = scopeText(l);
  await db.from('agreements').insert({ project_id: project.id, updated_by: bid.bidder_id, start_date: bid.start_date });
  await db.from('agreement_items').insert({
    project_id: project.id, position: 0, title: title.slice(0, 200), kind: 'work', price_cents: bid.price_cents,
    description: [scope, bid.inclusions ? `Included by the contractor: ${bid.inclusions}` : ''].filter(Boolean).join('\n\n').slice(0, 4000),
  });
  await db.from('agreement_milestones').insert(
    [['Deposit at signing', 20], ['Midpoint, materials on site', 40], ['Substantial completion', 30], ['Final walkthrough and lien waiver', 10]].map(([label, pct], position) => ({ project_id: project.id, position, label, pct })),
  );
  await db.from('messages').insert({ project_id: project.id, sender_id: user.id, sender_role: 'homeowner', tag: null, body: `What I posted on the marketplace:\n\n${scope}`.slice(0, 4000) });
  if (bid.note) await db.from('messages').insert({ project_id: project.id, sender_id: bid.bidder_id, sender_role: 'contractor', tag: null, body: `My bid note:\n\n${bid.note}`.slice(0, 4000) });

  await db.from('marketplace_listings').update({ project_id: project.id }).eq('id', l.id);
  await db.from('marketplace_bids').update({ status: 'won', updated_at: new Date().toISOString() }).eq('id', bid.id);
  const { data: lost } = await db.from('marketplace_bids').update({ status: 'not_selected', updated_at: new Date().toISOString() }).eq('listing_id', l.id).eq('status', 'waiting').select('bidder_id');

  await notifyUsers({ userIds: [bid.bidder_id], projectId: project.id, kind: 'bid', title: `You won ${title}: ${dollars(bid.price_cents)}`, body: 'The homeowner accepted your bid. The project is open with the scope and price filled in. Review the Agreement tab and send it for approval.' });
  await notifyUsers({ userIds: Array.from(new Set((lost ?? []).map((b) => b.bidder_id as string))), projectId: null, kind: 'bid', path: '/marketplace/bids', title: `${listingTitle(l)} went to another contractor`, body: 'Thanks for bidding. The homeowner chose a different bid.' });
  revalidatePath('/marketplace');
  redirect(`/projects/${project.id}/overview`);
}
