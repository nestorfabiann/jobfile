'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { JOB_TYPES, marketplaceEnabled } from '@/lib/marketplace';
import { judgeInsurance, readInsurance } from '@/lib/insuranceRead';
import { findPlace, googleConfigured, sameBusiness, searchPhrase } from '@/lib/googleRatings';
import { cleanUrl, instagramUrl, intOrNull, INSURANCE_KINDS, LANGUAGES, myOwnedCompany, PAYMENTS, pickFrom, SERVICES, type InsuranceKind } from '@/lib/companyProfile';

const IMG: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PHOTOS = 24;
const MAX_BYTES = 3_800_000;
export type UploadResult = { ok: true; message?: string; approved?: boolean } | { ok: false; error: string };

async function owner() {
  const c = await myOwnedCompany();
  if (!c) {
    redirect('/settings?error=Only+a+company+owner+can+edit+the+business+profile.');
    throw new Error('Not a company owner');
  }
  return c;
}
const txt = (f: FormData, k: string, n: number) => String(f.get(k) ?? '').trim().slice(0, n);

export async function saveBusinessProfile(formData: FormData) {
  const { companyId } = await owner();
  const name = txt(formData, 'name', 120);
  const row = {
    ...(name ? { name } : {}),
    about: txt(formData, 'about', 800),
    services: pickFrom(SERVICES, formData.getAll('services')),
    languages: pickFrom(LANGUAGES, formData.getAll('languages')),
    payments: pickFrom(PAYMENTS, formData.getAll('payments')),
    service_radius_mi: intOrNull(formData.get('service_radius_mi'), 1, 500),
    year_started: intOrNull(formData.get('year_started'), 1900, new Date().getFullYear()),
    crew_size: intOrNull(formData.get('crew_size'), 1, 10000),
    warranty: txt(formData, 'warranty', 120),
    hours: txt(formData, 'hours', 120),
    license_note: txt(formData, 'license_note', 160),
    website: cleanUrl(txt(formData, 'website', 300)),
    facebook: cleanUrl(txt(formData, 'facebook', 300)),
    instagram: instagramUrl(txt(formData, 'instagram', 300)),
    other_link: cleanUrl(txt(formData, 'other_link', 300)),
    // Local matching fields, only when the marketplace section of the form was shown.
    ...(marketplaceEnabled() && formData.get('matching') === '1'
      ? {
          business_zip: /^\d{5}$/.test(txt(formData, 'business_zip', 5)) ? txt(formData, 'business_zip', 5) : null,
          trades: pickFrom(Object.keys(JOB_TYPES), formData.getAll('trades')),
          job_alerts: formData.get('job_alerts') === 'on',
        }
      : {}),
  };
  const { error } = await supabaseAdmin().from('companies').update(row).eq('id', companyId);
  if (error) redirect('/settings/business?error=Could+not+save.+Check+that+the+database+step+was+run.');
  revalidatePath('/settings/business');
  revalidatePath(`/contractors/${companyId}`);
  const next = txt(formData, 'next', 60);
  redirect(/^\/marketplace\/[0-9a-f-]{36}$/i.test(next) ? next : '/settings/business?saved=1');
}

/** Logo (kind=logo) or a work photo (kind=work). The browser shrinks the image first. */
export async function uploadBusinessPhoto(formData: FormData): Promise<UploadResult> {
  try {
    const { companyId } = await owner();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'No photo was received.' };
    const ext = IMG[file.type];
    if (!ext) return { ok: false, error: 'Photos must be JPEG, PNG or WebP.' };
    if (file.size > MAX_BYTES) return { ok: false, error: 'That photo is too large.' };
    const db = supabaseAdmin();
    const isLogo = formData.get('kind') === 'logo';
    if (!isLogo) {
      const { count } = await db.from('company_photos').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
      if ((count ?? 0) >= MAX_PHOTOS) return { ok: false, error: `You can show up to ${MAX_PHOTOS} photos. Remove one first.` };
    }
    const path = `${companyId}/${randomUUID()}.${ext}`;
    const up = await db.storage.from('company-photos').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (up.error) return { ok: false, error: 'Could not store the photo. Check that the database step was run.' };
    if (isLogo) {
      const { data: old } = await db.from('companies').select('logo_path').eq('id', companyId).single();
      await db.from('companies').update({ logo_path: path }).eq('id', companyId);
      if (old?.logo_path) await db.storage.from('company-photos').remove([old.logo_path as string]);
    } else {
      const { error } = await db.from('company_photos').insert({ company_id: companyId, path, caption: txt(formData, 'caption', 120) });
      if (error) {
        await db.storage.from('company-photos').remove([path]);
        return { ok: false, error: 'Could not save the photo record.' };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong saving that photo.' };
  }
}

export async function deleteBusinessPhoto(formData: FormData) {
  const { companyId } = await owner();
  const id = String(formData.get('id') ?? '');
  const db = supabaseAdmin();
  const { data: ph } = await db.from('company_photos').select('path').eq('id', id).eq('company_id', companyId).maybeSingle();
  if (ph) {
    await db.storage.from('company-photos').remove([ph.path as string]);
    await db.from('company_photos').delete().eq('id', id).eq('company_id', companyId);
  }
  revalidatePath('/settings/business');
  redirect('/settings/business?saved=1');
}

/** Upload or replace an insurance certificate. It goes back to "pending" for admin review. */
export async function uploadInsurance(formData: FormData): Promise<UploadResult> {
  try {
    const ownerCo = await owner();
    const { companyId } = ownerCo;
    const kind = String(formData.get('kind') ?? '') as InsuranceKind;
    if (!(kind in INSURANCE_KINDS)) return { ok: false, error: 'Unknown insurance type.' };
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose the certificate file.' };
    const ext = file.type === 'application/pdf' ? 'pdf' : IMG[file.type];
    if (!ext) return { ok: false, error: 'The certificate must be a PDF or a photo (JPEG, PNG, WebP).' };
    if (file.size > MAX_BYTES) return { ok: false, error: 'That file is over 3.8 MB. Take a photo of the page instead, or save a smaller PDF.' };
    const typed = String(formData.get('expires_on') ?? '');
    const today = new Date().toISOString().slice(0, 10);
    if (typed && (!/^\d{4}-\d{2}-\d{2}$/.test(typed) || Number.isNaN(Date.parse(typed)))) return { ok: false, error: 'Check the expiry date.' };

    const db = supabaseAdmin();
    const buf = Buffer.from(await file.arrayBuffer());
    const read = await readInsurance(buf, file.type);
    const { data: prof } = await db.from('profiles').select('full_name').eq('id', ownerCo.user.id).maybeSingle<any>();
    const verdict = judgeInsurance(read, { kind: kind as 'liability' | 'workers_comp', businessName: ownerCo.name, ownerName: String(prof?.full_name ?? '') });
    const expires = read.ok && read.expires ? read.expires : typed;
    if (!expires) return { ok: false, error: 'We could not find the expiration date on this certificate. Enter it below and send it again.' };
    if (expires < today && !verdict.auto && !typed) return { ok: false, error: 'That policy looks expired. Upload the current certificate.' };
    if (typed && typed < today && !read.expires) return { ok: false, error: 'That policy has already expired.' };

    // Auto-approve only when everything checks out. A company's first certificate and a random 1 in 10 still go to an admin.
    let auto = verdict.auto;
    const reasons = [...verdict.reasons];
    let routine = '';
    if (auto) {
      const { count: approvedBefore } = await db.from('company_insurance').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'approved');
      if ((approvedBefore ?? 0) === 0) { auto = false; routine = 'first'; }
      else if (Math.random() < 0.1) { auto = false; routine = 'spot'; }
    }

    const path = `${companyId}/${randomUUID()}.${ext}`;
    const up = await db.storage.from('company-docs').upload(path, buf, { contentType: file.type, upsert: false });
    if (up.error) return { ok: false, error: 'Could not store the file. Check that the database step was run.' };
    const { data: old } = await db.from('company_insurance').select('path').eq('company_id', companyId).eq('kind', kind).maybeSingle();
    const now = new Date().toISOString();
    const base = {
      company_id: companyId, kind, path,
      carrier: txt(formData, 'carrier', 120), coverage: txt(formData, 'coverage', 60), expires_on: expires,
      status: auto ? 'approved' : 'pending', review_note: '', reviewed_by: null, reviewed_at: auto ? now : null, uploaded_at: now,
    };
    const detail = { insured: read.insured, kind: read.kind, expires: read.expires, read_ok: read.ok, reasons, routine };
    let { error } = await db.from('company_insurance').upsert({ ...base, auto_approved: auto, read_detail: detail }, { onConflict: 'company_id,kind' });
    if (error) ({ error } = await db.from('company_insurance').upsert(base, { onConflict: 'company_id,kind' })); // the 046 columns are not there yet
    if (error) {
      await db.storage.from('company-docs').remove([path]);
      return { ok: false, error: 'Could not save the insurance record.' };
    }
    if (old?.path) await db.storage.from('company-docs').remove([old.path as string]);
    revalidatePath('/settings/business');
    revalidatePath('/projects');
    if (auto) return { ok: true, approved: true, message: `Approved. Your insurance badge is live until ${expires}.` };
    if (routine) return { ok: true, message: 'Looks good. An admin does a quick check on certificates like this, usually within a day. We will tell you.' };
    return { ok: true, message: `Sent to an admin to check. ${reasons.join(' ')}`.trim() };
  } catch {
    return { ok: false, error: 'Something went wrong saving that certificate.' };
  }
}

export async function removeInsurance(formData: FormData) {
  const { companyId } = await owner();
  const kind = String(formData.get('kind') ?? '');
  const db = supabaseAdmin();
  const { data: ins } = await db.from('company_insurance').select('path').eq('company_id', companyId).eq('kind', kind).maybeSingle();
  if (ins) {
    await db.storage.from('company-docs').remove([ins.path as string]);
    await db.from('company_insurance').delete().eq('company_id', companyId).eq('kind', kind);
  }
  revalidatePath('/settings/business');
  redirect('/settings/business?saved=1');
}

const BACK = '/settings/business';
const oops = (m: string) => redirect(`${BACK}?error=${encodeURIComponent(m)}#bp-ratings`);

/** Links a Google Business page. A matching name and ZIP goes live at once; anything else waits for an admin. */
export async function linkGoogleRating(formData: FormData) {
  const { companyId } = await owner();
  if (!googleConfigured()) return oops('Google ratings are not turned on yet.');
  const input = txt(formData, 'google_link', 400);
  if (!input) return oops('Paste your Google Maps link or type your business name and city.');
  const db = supabaseAdmin();
  const { data: c } = await db.from('companies').select('name,business_zip').eq('id', companyId).single<any>();
  const zip = String(c?.business_zip ?? '');
  let place;
  try {
    const q = await searchPhrase(input, zip);
    if (!q) return oops('We could not read that link. Open your business in Google Maps, tap Share, and paste that link.');
    place = await findPlace(q);
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e;
    return oops('Google did not answer. Try again in a moment.');
  }
  if (!place) return oops('We could not find that business on Google. Try typing the name and city instead.');
  const match = sameBusiness(place.name, String(c?.name ?? '')) && (!zip || place.address.includes(zip));
  const { error } = await db.from('company_ratings').upsert({
    company_id: companyId, source: 'google', link: input, place_id: place.id, place_name: place.name, place_address: place.address, maps_url: place.url,
    rating: place.rating, review_count: place.count, status: match ? 'approved' : 'pending', fetched_at: new Date().toISOString(),
  });
  if (error) return oops('Could not save the link. Try again.');
  revalidatePath(BACK);
  revalidatePath(`/contractors/${companyId}`);
  redirect(`${BACK}?saved=1#bp-ratings`);
}

export async function unlinkGoogleRating() {
  const { companyId } = await owner();
  await supabaseAdmin().from('company_ratings').delete().eq('company_id', companyId).eq('source', 'google');
  revalidatePath(BACK);
  revalidatePath(`/contractors/${companyId}`);
  redirect(`${BACK}?saved=1#bp-ratings`);
}
