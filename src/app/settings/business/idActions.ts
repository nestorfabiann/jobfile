'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { myOwnedCompany } from '@/lib/companyProfile';
import { matchName, readIdPhoto, type NameMatch } from '@/lib/idCheck';

const MAX_BYTES = 3_800_000;
export type IdResult =
  | { ok: true; name: string; expires: string | null; nameMatch: NameMatch; flags: string[]; read: boolean }
  | { ok: false; error: string };

/** Stores the ID photo privately, reads name and expiry, and sends it to the admin queue. A person always decides. */
export async function submitIdCheck(formData: FormData): Promise<IdResult> {
  try {
    const me = await myOwnedCompany();
    if (!me) return { ok: false, error: 'Only a company owner can verify the business.' };
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a photo of your ID.' };
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { ok: false, error: 'Use a photo (JPEG, PNG or WebP).' };
    if (file.size > MAX_BYTES) return { ok: false, error: 'That photo is too large. Take it again.' };
    const buf = Buffer.from(await file.arrayBuffer());
    const db = supabaseAdmin();

    const { data: prof } = await db.from('profiles').select('full_name').eq('id', me.user.id).maybeSingle<any>();
    const accountName = String(prof?.full_name ?? '').trim();
    if (!accountName) return { ok: false, error: 'Add your full name in Settings first, so we can match it to your ID.' };

    const read = await readIdPhoto(buf);
    const flags: string[] = [];
    if (!read.ok) flags.push('not_read');
    else {
      if (!read.isId) flags.push('not_an_id');
      if (!read.legible) flags.push('blurry');
      if (read.screenPhoto) flags.push('screen_photo');
      if (read.looksEdited) flags.push('looks_edited');
      if (!read.expires) flags.push('no_expiry');
      else if (read.expires < new Date().toISOString().slice(0, 10)) flags.push('expired');
    }
    const nm: NameMatch = read.ok && read.name ? matchName(read.name, accountName) : 'unknown';
    if (nm === 'close') flags.push('name_close');
    if (nm === 'no') flags.push('name_differs');

    const path = `${me.companyId}/id-${randomUUID()}.jpg`;
    const up = await db.storage.from('company-docs').upload(path, buf, { contentType: file.type, upsert: false });
    if (up.error) return { ok: false, error: 'Could not store the photo. Try again.' };
    const { data: old } = await db.from('company_id_checks').select('photo_path').eq('company_id', me.companyId).maybeSingle<any>();
    const { error } = await db.from('company_id_checks').upsert(
      { company_id: me.companyId, user_id: me.user.id, photo_path: path, read_name: read.name, read_expires: read.expires, name_match: nm, flags, status: 'pending', review_note: '', reviewed_by: null, reviewed_at: null, verified_at: null, created_at: new Date().toISOString() },
      { onConflict: 'company_id' },
    );
    if (error) {
      await db.storage.from('company-docs').remove([path]);
      return { ok: false, error: 'Could not save. Ask Jobfile support to finish the ID check setup.' };
    }
    if (old?.photo_path) await db.storage.from('company-docs').remove([old.photo_path as string]);
    revalidatePath('/settings/business');
    return { ok: true, name: read.name, expires: read.expires, nameMatch: nm, flags, read: read.ok };
  } catch {
    return { ok: false, error: 'Something went wrong. Try again.' };
  }
}

/** Withdraws a pending check and deletes the photo. */
export async function cancelIdCheck() {
  const me = await myOwnedCompany();
  if (!me) return;
  const db = supabaseAdmin();
  const { data } = await db.from('company_id_checks').select('photo_path,status').eq('company_id', me.companyId).maybeSingle<any>();
  if (data?.status === 'pending') {
    if (data.photo_path) await db.storage.from('company-docs').remove([data.photo_path as string]);
    await db.from('company_id_checks').delete().eq('company_id', me.companyId);
  }
  revalidatePath('/settings/business');
}
