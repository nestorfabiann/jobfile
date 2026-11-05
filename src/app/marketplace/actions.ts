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
import { aiConfigured, makeReference, makePostReview, type Reference } from '@/lib/marketplaceAI';
import { cleanAnswers, questionsFor } from '@/lib/scopeQuestions';
import { cleanDraft } from '@/lib/drafts';
import { hasContactInfo } from '@/lib/contactInfo';
import { MAX_VIDEOS, MAX_VIDEO_BYTES, VIDEO_TYPES } from '@/lib/mediaLimits';

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

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };
const bad = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Creates the listing and tells the matching contractors. The browser then uploads any photos and videos and opens the page. */
export async function createListing(formData: FormData): Promise<CreateResult> {
  try {
    return await createListingInner(formData);
  } catch (e: any) {
    if (e?.digest) throw e; // redirects and not-found pass through
    console.error('createListing failed', e);
    return bad(`Could not post the project (${String(e?.message ?? 'unknown error').slice(0, 140)}).`);
  }
}

async function createListingInner(formData: FormData): Promise<CreateResult> {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  if (await myCompany(user.id)) return bad('Contractors bid on projects. Homeowners post them.');

  const jobType = txt(formData, 'job_type', 60);
  if (!JOB_TYPES[jobType]) return bad('Choose a job type.');
  const picked = cleanItems(jobType, formData.getAll('items').map(String));
  if (!picked.length) return bad('Pick at least one item for your scope.');
  const zip = txt(formData, 'zip', 5);
  if (!/^\d{5}$/.test(zip)) return bad('Enter a 5-digit ZIP code.');
  const sizeN = parseInt(txt(formData, 'size', 10).replace(/\D/g, ''), 10);
  const size = Number.isFinite(sizeN) && sizeN > 0 ? Math.min(1_000_000, sizeN) : null;
  const details = txt(formData, 'details', 1000);
  let bmin: number | null = parseDollars(txt(formData, 'budget_min', 20)) || null;
  let bmax: number | null = parseDollars(txt(formData, 'budget_max', 20)) || null;
  if (bmin && bmax && bmin > bmax) [bmin, bmax] = [bmax, bmin];

  const { count: open } = await db.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('homeowner_id', user.id).eq('status', 'open').gt('expires_at', new Date().toISOString());
  if ((open ?? 0) >= MAX_OPEN_LISTINGS) return bad(`You have ${MAX_OPEN_LISTINGS} open projects. Close one first.`);
  const { count: recent } = await db.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('homeowner_id', user.id).gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((recent ?? 0) >= MAX_LISTINGS_PER_DAY) return bad('You posted a lot today. Try again tomorrow.');

  // A reference counts only if this server made it for exactly this scope.
  let ref: Reference | null = null;
  const refId = txt(formData, 'ref_id', 40);
  if (refId) {
    const { data: call } = await db.from('marketplace_ai_calls').select('input_hash,result,created_at').eq('id', refId).eq('user_id', user.id).maybeSingle();
    const fresh = call && Date.now() - new Date(call.created_at as string).getTime() < 3 * 3600_000;
    if (fresh && call.input_hash === inputHash(jobType, picked.map((p) => p.item), size, zip, details)) ref = call.result as Reference;
  }

  let answers: Record<string, string> = {};
  try { answers = cleanAnswers(jobType, JSON.parse(txt(formData, 'answers', 6000) || '{}')); } catch { /* ignore bad JSON */ }
  if (!answers.when) return bad('Choose when you want to start.');

  const { data: prof } = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const row = {
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
  };
  const cols = 'id,homeowner_id,job_type,zip,city,items,ai_low_cents,ai_high_cents';
  const visitPref = ['yes', 'maybe', 'no'].includes(String(formData.get('visit_pref'))) ? String(formData.get('visit_pref')) : 'yes';
  const visitFree = formData.getAll('visit_free').map(String).filter((x) => ['Weekday mornings', 'Weekday evenings', 'Saturdays', 'Sundays'].includes(x)).join(', ');
  let { data: l, error } = await db.from('marketplace_listings').insert({ ...row, answers, visit_pref: visitPref, visit_free: visitFree }).select(cols).single();
  // Until the 023 and 032 columns exist, post without them rather than fail.
  if (error && /visit_/i.test(error.message ?? '')) ({ data: l, error } = await db.from('marketplace_listings').insert({ ...row, answers }).select(cols).single());
  if (error && /answers/i.test(error.message ?? '')) ({ data: l, error } = await db.from('marketplace_listings').insert(row).select(cols).single());
  if (error || !l) return bad('Could not post the project. Check that the database step was run.');
  await alertMatchingContractors(l as any);
  const draftId = txt(formData, 'draft_id', 40);
  if (/^[0-9a-f-]{36}$/i.test(draftId)) await db.from('marketplace_drafts').delete().eq('id', draftId).eq('user_id', user.id);
  revalidatePath('/marketplace');
  return { ok: true, id: l.id as string };
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

export type VideoUrlResult = { ok: true; path: string; token: string } | { ok: false; error: string };

/** Step 1 of a video upload: check the limits and hand the browser a one-time upload token. The video itself goes straight to storage. */
export async function videoUploadUrl(input: { listingId: string; contentType: string; size: number }): Promise<VideoUrlResult> {
  try {
    requireMarketplace();
    const { user } = await requireUser();
    const l = await loadListing(String(input.listingId ?? ''));
    if (!l || l.homeowner_id !== user.id) return { ok: false, error: 'Not allowed.' };
    const ext = VIDEO_TYPES[input.contentType];
    if (!ext) return { ok: false, error: 'Videos must be MP4, MOV or WebM.' };
    if (!(input.size > 0) || input.size > MAX_VIDEO_BYTES) return { ok: false, error: 'Videos can be up to 50 MB. Trim it to under a minute and try again.' };
    const db = supabaseAdmin();
    const { count } = await db.from('marketplace_videos').select('id', { count: 'exact', head: true }).eq('listing_id', l.id);
    if ((count ?? 0) >= MAX_VIDEOS) return { ok: false, error: `You can add up to ${MAX_VIDEOS} videos.` };
    const path = `${l.id}/${randomUUID()}.${ext}`;
    const { data, error } = await db.storage.from('listing-videos').createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: 'Could not start the video upload. Check that the database step (013) was run.' };
    return { ok: true, path, token: data.token };
  } catch {
    return { ok: false, error: 'Something went wrong starting the video upload.' };
  }
}

/** Step 2: after the browser finished uploading, confirm the file exists and is within the limit, then record it. */
export async function saveListingVideo(input: { listingId: string; path: string }): Promise<UploadResult> {
  try {
    requireMarketplace();
    const { user } = await requireUser();
    const l = await loadListing(String(input.listingId ?? ''));
    if (!l || l.homeowner_id !== user.id) return { ok: false, error: 'Not allowed.' };
    const m = /^([0-9a-f-]{36})\/([0-9a-f-]{36}\.(mp4|mov|webm))$/i.exec(String(input.path ?? ''));
    if (!m || m[1] !== l.id) return { ok: false, error: 'That upload does not belong to this project.' };
    const db = supabaseAdmin();
    const { data: files } = await db.storage.from('listing-videos').list(l.id, { search: m[2] });
    const f = (files ?? []).find((x) => x.name === m[2]);
    if (!f) return { ok: false, error: 'The video did not finish uploading. Try again.' };
    const size = Number((f.metadata as { size?: number } | null)?.size ?? 0);
    if (size > MAX_VIDEO_BYTES) {
      await db.storage.from('listing-videos').remove([input.path]);
      return { ok: false, error: 'Videos can be up to 50 MB.' };
    }
    const { count } = await db.from('marketplace_videos').select('id', { count: 'exact', head: true }).eq('listing_id', l.id);
    if ((count ?? 0) >= MAX_VIDEOS) {
      await db.storage.from('listing-videos').remove([input.path]);
      return { ok: false, error: `You can add up to ${MAX_VIDEOS} videos.` };
    }
    const { error } = await db.from('marketplace_videos').insert({ listing_id: l.id, path: input.path, size_bytes: size || null });
    if (error) {
      await db.storage.from('listing-videos').remove([input.path]);
      return { ok: false, error: 'Could not save the video record.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong saving that video.' };
  }
}

export async function deleteListingVideo(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const l = await loadListing(String(formData.get('listing_id') ?? ''));
  if (!l || l.homeowner_id !== user.id || !listingOpen(l)) redirect('/marketplace');
  const db = supabaseAdmin();
  const { data: v } = await db.from('marketplace_videos').select('path').eq('id', String(formData.get('id') ?? '')).eq('listing_id', l.id).maybeSingle();
  if (v?.path) {
    await db.storage.from('listing-videos').remove([v.path as string]);
    await db.from('marketplace_videos').delete().eq('id', String(formData.get('id'))).eq('listing_id', l.id);
  }
  revalidatePath(`/marketplace/${l.id}`);
  redirect(`/marketplace/${l.id}`);
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

/** Keep an open project taking bids for 30 more days, counted from today or its current end date, whichever is later. */
export async function extendListing(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const l = await loadListing(String(formData.get('listing_id') ?? ''));
  if (!l || l.homeowner_id !== user.id) redirect('/marketplace');
  const path = `/marketplace/${l.id}`;
  if (l.status !== 'open') back(path, 'Only an open project can be extended.');
  const db = supabaseAdmin();
  const next = new Date(Math.max(Date.now(), new Date(l.expires_at).getTime()) + 30 * 86400_000).toISOString();
  await db.from('marketplace_listings').update({ expires_at: next }).eq('id', l.id).eq('status', 'open');
  const { data: waiting } = await db.from('marketplace_bids').select('bidder_id').eq('listing_id', l.id).eq('status', 'waiting');
  await notifyUsers({ userIds: Array.from(new Set((waiting ?? []).map((b: any) => b.bidder_id as string))), projectId: null, kind: 'bid', path, title: `${listingTitle(l)} is still open`, body: 'The homeowner kept this project open for 30 more days. Your bid is still waiting.' });
  revalidatePath(path);
  redirect(`${path}?extended=1`);
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
  // An admin can hide a business from the marketplace (017). It cannot place new bids while hidden.
  const { data: hc } = await supabaseAdmin().from('companies').select('*').eq('id', co.companyId).maybeSingle<any>();
  if (hc?.hidden_at) back(path, 'Your business is hidden from the marketplace right now, so you cannot place new bids. Contact Jobfile for help.');

  const price = parseDollars(txt(formData, 'price', 20));
  if (price < 100_00 || price > 10_000_000_00) back(path, 'Enter your price in dollars (for example 31400).');
  const wk = parseInt(txt(formData, 'weeks', 4), 10);
  const weeks = Number.isFinite(wk) && wk >= 1 && wk <= 520 ? wk : null;
  const sd = txt(formData, 'start_date', 10);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(sd) && sd >= todayIso() ? sd : null;

  const db = supabaseAdmin();
  const { data: existing } = await db.from('marketplace_bids').select('id,status,price_cents').eq('listing_id', l.id).eq('company_id', co.companyId).maybeSingle();
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
  // A visit asked for before bidding now belongs to the bid.
  const { data: myBidRow } = await db.from('marketplace_bids').select('id').eq('listing_id', l.id).eq('company_id', co.companyId).maybeSingle();
  if (myBidRow) await db.from('visits').update({ bid_id: myBidRow.id }).eq('listing_id', l.id).eq('created_by', user.id).is('bid_id', null).neq('status', 'canceled');
  if (!existing || existing.status === 'withdrawn') {
    await notifyUsers({ userIds: [l.homeowner_id], projectId: null, kind: 'bid', path: `/marketplace/${l.id}`, title: `New bid on ${listingTitle(l)}: ${dollars(price)}`, body: `${co.name} bid ${dollars(price)}. Open Marketplace to compare your bids.` });
    // Three waiting bids is the point where comparing becomes useful. Said once, when the third one arrives.
    const { count: waitingBids } = await db.from('marketplace_bids').select('id', { count: 'exact', head: true }).eq('listing_id', l.id).eq('status', 'waiting');
    if ((waitingBids ?? 0) === 3) {
      const { data: ps } = await db.from('marketplace_bids').select('price_cents').eq('listing_id', l.id).eq('status', 'waiting');
      const prices = (ps ?? []).map((x: any) => x.price_cents as number);
      await notifyUsers({ userIds: [l.homeowner_id], projectId: null, kind: 'bid', path: `/marketplace/${l.id}`, title: `You have 3 bids to compare on ${listingTitle(l)}`, body: `Prices from ${dollars(Math.min(...prices))} to ${dollars(Math.max(...prices))}. Open the project and tick Compare to see them side by side.`, cta: 'Compare bids' });
    }
  } else if (existing.status === 'waiting' && existing.price_cents !== price) {
    // A price change is worth knowing about, but only once per contractor per day.
    const title = `${co.name} changed their bid on ${listingTitle(l)}`;
    const { count: sent } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', l.homeowner_id).eq('kind', 'bid').eq('title', title).gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    if ((sent ?? 0) === 0) {
      await notifyUsers({ userIds: [l.homeowner_id], projectId: null, kind: 'bid', path: `/marketplace/${l.id}`, title, body: `From ${dollars(existing.price_cents as number)} to ${dollars(price)}. Open the project to compare.` });
    }
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
  const { data: gone } = await supabaseAdmin().from('marketplace_bids').update({ status: 'withdrawn', updated_at: new Date().toISOString() }).eq('listing_id', listingId).eq('company_id', co.companyId).eq('status', 'waiting').select('id');
  if ((gone ?? []).length) {
    const l = await loadListing(listingId);
    if (l) {
      const { count: left } = await supabaseAdmin().from('marketplace_bids').select('id', { count: 'exact', head: true }).eq('listing_id', l.id).eq('status', 'waiting');
      await notifyUsers({ userIds: [l.homeowner_id], projectId: null, kind: 'bid', path: `/marketplace/${l.id}`, title: `${co.name} withdrew their bid on ${listingTitle(l)}`, body: (left ?? 0) > 0 ? `You still have ${left} bid${left === 1 ? '' : 's'} waiting.` : 'You have no bids waiting right now. More contractors can still bid.' });
    }
  }
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
  // Visits already arranged with the winner carry over to the new project's schedule.
  await db.from('visits').update({ project_id: project.id }).eq('bid_id', bid.id).neq('status', 'canceled');
  await db.from('marketplace_bids').update({ status: 'won', updated_at: new Date().toISOString() }).eq('id', bid.id);
  // A team bid: tell the partner company it won, so the lead and partner can start planning.
  try {
    const { data: tb } = await db.from('team_bids').select('id').eq('bid_id', bid.id).maybeSingle();
    if (tb) {
      const { data: tps } = await db.from('team_partners').select('company_id').eq('team_bid_id', tb.id).eq('status', 'confirmed');
      for (const tp of (tps ?? []) as any[]) {
        const { data: ms } = await db.from('company_members').select('user_id').eq('company_id', tp.company_id);
        await notifyUsers({ userIds: (ms ?? []).map((m: any) => m.user_id as string), projectId: null, kind: 'bid', path: '/collaborate', title: `Your team won ${title}`, body: 'The homeowner hired the team. The lead will contact you to plan the schedule.' });
      }
    }
  } catch { /* team tables not created yet */ }
  const { data: lost } = await db.from('marketplace_bids').update({ status: 'not_selected', updated_at: new Date().toISOString() }).eq('listing_id', l.id).eq('status', 'waiting').select('bidder_id');

  await notifyUsers({ userIds: [bid.bidder_id], projectId: project.id, kind: 'bid', title: `You won ${title}: ${dollars(bid.price_cents)}`, body: 'The homeowner accepted your bid. The project is open with the scope and price filled in. Review the Agreement tab and send it for approval.' });
  await notifyUsers({ userIds: Array.from(new Set((lost ?? []).map((b) => b.bidder_id as string))), projectId: null, kind: 'bid', path: '/marketplace/bids', title: `${listingTitle(l)} went to another contractor`, body: 'Thanks for bidding. The homeowner chose a different bid.' });
  revalidatePath('/marketplace');
  redirect(`/projects/${project.id}/overview?hired=1`);
}


// ---------- Messages before a bid is accepted ----------

/** Homeowner and bidding contractor can write short messages while the project is open and the bid is waiting. */
export async function sendBidMessage(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const listingId = String(formData.get('listing_id') ?? '');
  const bidId = String(formData.get('bid_id') ?? '');
  const path = `/marketplace/${listingId}`;
  const l = await loadListing(listingId);
  if (!l) redirect('/marketplace');
  const db = supabaseAdmin();
  const { data: bid } = await db.from('marketplace_bids').select('id,listing_id,bidder_id,company_id,status').eq('id', bidId).eq('listing_id', l.id).maybeSingle();
  if (!bid) back(path, 'That bid was not found.');
  const isOwner = l.homeowner_id === user.id;
  const co = isOwner ? null : await myCompany(user.id);
  if (!isOwner && !(co && co.companyId === bid.company_id)) back(path, 'You cannot message on this bid.');
  const here = `${path}?open=${bid.id}`;
  if (!listingOpen(l) || bid.status !== 'waiting') back(here, 'Messages are closed because this project or bid is no longer open.');

  const body = txt(formData, 'body', 1000);
  if (!body) back(here, 'Write a message first.');
  if (hasContactInfo(body)) back(here, 'Phone numbers, emails and web links are not allowed until the bid is accepted. Ask your question here instead.');

  const since = new Date(Date.now() - 86400000).toISOString();
  const { count: today } = await db.from('marketplace_messages').select('id', { count: 'exact', head: true }).eq('bid_id', bid.id).eq('sender_id', user.id).gt('created_at', since);
  if ((today ?? 0) >= 30) back(here, 'That is a lot of messages for one day. Try again tomorrow.');

  // Only the first message in a row alerts the other side, so a back-and-forth does not flood their email.
  const { count: waiting } = await db.from('marketplace_messages').select('id', { count: 'exact', head: true }).eq('bid_id', bid.id).eq('sender_id', user.id).is('read_at', null);
  const { error } = await db.from('marketplace_messages').insert({ listing_id: l.id, bid_id: bid.id, sender_id: user.id, body });
  if (error) back(here, 'Could not send. Try again.');
  if ((waiting ?? 0) === 0) {
    await notifyUsers({
      userIds: [isOwner ? (bid.bidder_id as string) : l.homeowner_id],
      projectId: null, kind: 'bid', path,
      title: `New message about ${listingTitle(l)}`,
      body: isOwner ? 'The homeowner sent you a message about your bid. Open the project to read and reply.' : `${co?.name ?? 'A contractor'} sent you a message about their bid. Open the project to read and reply.`,
      cta: 'Read and reply',
    });
  }
  redirect(`${here}#bid-${bid.id}`);
}


// ---------- Drafts of the post form ----------

const MAX_DRAFTS = 3;

export async function saveDraft(input: { id?: string; data: unknown }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  if (await myCompany(user.id)) return { ok: false, error: 'Contractors bid on projects. Homeowners post them.' };
  const data = cleanDraft(input.data);
  const now = new Date().toISOString();
  if (input.id && /^[0-9a-f-]{36}$/i.test(input.id)) {
    const { data: upd } = await db.from('marketplace_drafts').update({ data, updated_at: now }).eq('id', input.id).eq('user_id', user.id).select('id');
    if ((upd ?? []).length) return { ok: true, id: input.id };
  }
  const { count } = await db.from('marketplace_drafts').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  if ((count ?? 0) >= MAX_DRAFTS) return { ok: false, error: `You already have ${MAX_DRAFTS} drafts. Delete one on the Posted jobs tab to save this one.` };
  const { data: row, error } = await db.from('marketplace_drafts').insert({ user_id: user.id, data }).select('id').single();
  if (error || !row) return { ok: false, error: 'Could not save the draft.' };
  return { ok: true, id: row.id as string };
}

export async function deleteDraft(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const id = String(formData.get('id') ?? '');
  if (/^[0-9a-f-]{36}$/i.test(id)) await supabaseAdmin().from('marketplace_drafts').delete().eq('id', id).eq('user_id', user.id);
  revalidatePath('/projects');
  redirect(String(formData.get('back') ?? '') === '/projects' ? '/projects' : '/projects?tab=posted');
}


// ---------- Optional AI review of the post ----------

export type ReviewResult = { ok: true; questions: string[] } | { ok: false; error: string };

/** Asks up to three follow-up questions a contractor would ask. Shares the daily AI limit with the cost reference. */
export async function checkPost(input: { jobType: string; items: string[]; answers: unknown; size: string; details: string }): Promise<ReviewResult> {
  requireMarketplace();
  const { user } = await requireUser();
  if (!aiConfigured()) return { ok: false, error: 'The post review is not available yet. You can still post your project.' };
  const jobType = String(input.jobType ?? '');
  if (!JOB_TYPES[jobType]) return { ok: false, error: 'Choose a job type first.' };
  const picked = cleanItems(jobType, Array.isArray(input.items) ? input.items.map(String) : []);
  if (!picked.length) return { ok: false, error: 'Pick at least one item first.' };
  const answers = cleanAnswers(jobType, input.answers);
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await db.from('marketplace_ai_calls').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gt('created_at', since);
  if ((count ?? 0) >= AI_DAILY_LIMIT) return { ok: false, error: 'You have used today’s AI checks. Try again tomorrow, or post as is.' };
  const labeled = questionsFor(jobType).filter((q) => answers[q.k]).map((q) => ({ question: q.label, answer: answers[q.k] }));
  const r = await makePostReview({ jobType, items: picked.map((p) => p.item), answers: labeled, size: String(input.size ?? '').replace(/\D/g, '').slice(0, 7), details: String(input.details ?? '').trim().slice(0, 1000) });
  if (!r.ok) return r;
  await db.from('marketplace_ai_calls').insert({ user_id: user.id, input_hash: 'review', result: { questions: r.questions } });
  return { ok: true, questions: r.questions };
}
