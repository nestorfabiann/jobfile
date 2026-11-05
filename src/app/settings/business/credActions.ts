'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { cleanUrl, myOwnedCompany } from '@/lib/companyProfile';
import { CRED_KINDS } from '@/lib/credentials';

const IMG: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 3_800_000;
const MAX_CREDS = 12;
const back = (m: string, kind: 'saved' | 'error') => redirect(`/settings/business?${kind}=${kind === 'saved' ? '1' : encodeURIComponent(m)}#bp-cred`);

async function owner() {
  const c = await myOwnedCompany();
  if (!c) redirect('/settings?error=Only+a+company+owner+can+edit+the+business+profile.');
  return c!;
}

/** Adds a credential. It shows as "Stated by contractor" until an admin checks the link or proof. */
export async function addCredential(formData: FormData) {
  const { companyId } = await owner();
  const kind = String(formData.get('kind') ?? '');
  if (!CRED_KINDS.some((k) => k[0] === kind)) back('Pick the kind of credential.', 'error');
  const name = String(formData.get('name') ?? '').trim().slice(0, 100);
  if (!name) back('Enter the name of the credential.', 'error');
  const rawLink = String(formData.get('link') ?? '').trim();
  const link = rawLink ? cleanUrl(rawLink) : '';
  if (rawLink && !link) back('That link does not look right. Use a full web address.', 'error');
  const file = formData.get('file');
  const hasFile = file instanceof File && file.size > 0;
  if (!link && !hasFile) back('Add a link to your listing, or upload proof, so homeowners and Jobfile can check it.', 'error');
  const exp = String(formData.get('expires_on') ?? '');
  if (exp && (!/^\d{4}-\d{2}-\d{2}$/.test(exp) || Number.isNaN(Date.parse(exp)))) back('Check the expiry date.', 'error');
  if (exp && exp < new Date().toISOString().slice(0, 10)) back('That credential has already expired.', 'error');

  const db = supabaseAdmin();
  const { count } = await db.from('company_credentials').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
  if ((count ?? 0) >= MAX_CREDS) back(`You can list up to ${MAX_CREDS} credentials. Remove one first.`, 'error');

  let path: string | null = null;
  if (hasFile) {
    const f = file as File;
    const ext = f.type === 'application/pdf' ? 'pdf' : IMG[f.type];
    if (!ext) back('Proof must be a PDF or a photo (JPEG, PNG, WebP).', 'error');
    if (f.size > MAX_BYTES) back('That file is over 3.8 MB. Take a photo of the page instead, or save a smaller PDF.', 'error');
    path = `${companyId}/cred-${randomUUID()}.${ext}`;
    const up = await db.storage.from('company-docs').upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: false });
    if (up.error) back('Could not store the file. Try again.', 'error');
  }
  const { error } = await db.from('company_credentials').insert({ company_id: companyId, kind, name, link: link || null, proof_path: path, expires_on: exp || null });
  if (error) {
    if (path) await db.storage.from('company-docs').remove([path]);
    back('Could not save. Ask Jobfile support to finish the credentials setup.', 'error');
  }
  revalidatePath('/settings/business');
  back('', 'saved');
}

export async function removeCredential(formData: FormData) {
  const { companyId } = await owner();
  const id = String(formData.get('id') ?? '');
  const db = supabaseAdmin();
  const { data: c } = await db.from('company_credentials').select('id,proof_path').eq('id', id).eq('company_id', companyId).maybeSingle<any>();
  if (c) {
    if (c.proof_path) await db.storage.from('company-docs').remove([c.proof_path as string]);
    await db.from('company_credentials').delete().eq('id', id).eq('company_id', companyId);
  }
  revalidatePath('/settings/business');
  back('', 'saved');
}
