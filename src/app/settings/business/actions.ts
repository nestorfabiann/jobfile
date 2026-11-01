'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { cleanUrl, instagramUrl, intOrNull, INSURANCE_KINDS, LANGUAGES, myOwnedCompany, PAYMENTS, pickFrom, SERVICES, type InsuranceKind } from '@/lib/companyProfile';

const IMG: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PHOTOS = 24;
const MAX_BYTES = 3_800_000;
export type UploadResult = { ok: true } | { ok: false; error: string };

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
  };
  const { error } = await supabaseAdmin().from('companies').update(row).eq('id', companyId);
  if (error) redirect('/settings/business?error=Could+not+save.+Check+that+the+database+step+was+run.');
  revalidatePath('/settings/business');
  revalidatePath(`/contractors/${companyId}`);
  redirect('/settings/business?saved=1');
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
    const { companyId } = await owner();
    const kind = String(formData.get('kind') ?? '') as InsuranceKind;
    if (!(kind in INSURANCE_KINDS)) return { ok: false, error: 'Unknown insurance type.' };
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose the certificate file.' };
    const ext = file.type === 'application/pdf' ? 'pdf' : IMG[file.type];
    if (!ext) return { ok: false, error: 'The certificate must be a PDF or a photo (JPEG, PNG, WebP).' };
    if (file.size > MAX_BYTES) return { ok: false, error: 'That file is over 3.8 MB. Take a photo of the page instead, or save a smaller PDF.' };
    const expires = String(formData.get('expires_on') ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || Number.isNaN(Date.parse(expires))) return { ok: false, error: 'Enter the date the policy expires.' };
    if (expires < new Date().toISOString().slice(0, 10)) return { ok: false, error: 'That policy has already expired.' };

    const db = supabaseAdmin();
    const path = `${companyId}/${randomUUID()}.${ext}`;
    const up = await db.storage.from('company-docs').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (up.error) return { ok: false, error: 'Could not store the file. Check that the database step was run.' };
    const { data: old } = await db.from('company_insurance').select('path').eq('company_id', companyId).eq('kind', kind).maybeSingle();
    const { error } = await db.from('company_insurance').upsert(
      {
        company_id: companyId, kind, path,
        carrier: txt(formData, 'carrier', 120), coverage: txt(formData, 'coverage', 60), expires_on: expires,
        status: 'pending', review_note: '', reviewed_by: null, reviewed_at: null, uploaded_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,kind' },
    );
    if (error) {
      await db.storage.from('company-docs').remove([path]);
      return { ok: false, error: 'Could not save the insurance record.' };
    }
    if (old?.path) await db.storage.from('company-docs').remove([old.path as string]);
    revalidatePath('/settings/business');
    return { ok: true };
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
