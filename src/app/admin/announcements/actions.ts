'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { audit, requireAdmin } from '@/lib/admin';
import { ANN_BUCKET, cleanHref, loadPeople, matches, parseZips, type Ann } from '@/lib/announce';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const ROLES = ['homeowners', 'contractors', 'everyone'];
const ACTS = ['any', 'posted', 'noproject', 'nobids'];

export async function previewReach(input: { role: string; zips: string; activity: string }): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { db } = await requireAdmin();
  const role = ROLES.includes(input.role) ? (input.role as Ann['role']) : 'homeowners';
  const activity = ACTS.includes(input.activity) ? (input.activity as Ann['activity']) : 'any';
  try {
    const people = await loadPeople(db);
    const zips = parseZips(input.zips);
    return { ok: true, count: people.filter((p) => matches(p, { role, zips, activity })).length };
  } catch {
    return { ok: false, error: 'Could not count right now.' };
  }
}

export async function saveAnnouncement(f: FormData) {
  const { user: me, db } = await requireAdmin();
  const back = (m: string): never => redirect(`/admin/announcements/new?error=${encodeURIComponent(m)}`);
  const title = str(f, 'title').slice(0, 80);
  const body = str(f, 'body').slice(0, 300);
  const buttonText = str(f, 'button_text').slice(0, 30);
  const rawHref = str(f, 'button_href');
  const href = cleanHref(rawHref);
  const style = ['banner', 'sheet', 'picture'].includes(str(f, 'style')) ? str(f, 'style') : 'banner';
  const color = ['green', 'orange', 'blue', 'violet'].includes(str(f, 'color')) ? str(f, 'color') : 'green';
  const imageMode = str(f, 'image_mode') === 'full' ? 'full' : 'top';
  const role = ROLES.includes(str(f, 'role')) ? str(f, 'role') : 'homeowners';
  const activity = ACTS.includes(str(f, 'activity')) ? str(f, 'activity') : 'any';
  const zips = parseZips(str(f, 'zips'));
  const alt = str(f, 'image_alt').slice(0, 160);
  const publish = str(f, 'intent') === 'publish';
  const endsRaw = str(f, 'ends_at');
  const ends = endsRaw && !Number.isNaN(Date.parse(`${endsRaw}T23:59:59-06:00`)) ? new Date(`${endsRaw}T23:59:59-06:00`).toISOString() : null;

  if (!title) back('Add a title.');
  if (rawHref && !href) back('The link must be a Jobfile page that starts with / (like /marketplace/new) or a web address that starts with https://.');
  if ((buttonText && !href) || (href && !buttonText)) back('Add both the button text and where it goes, or leave both empty.');

  let imagePath = '';
  const file = f.get('image');
  if (file instanceof File && file.size > 0) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) back('Use a JPG, PNG or WebP picture.');
    if (file.size > 2 * 1024 * 1024) back('That picture is over 2 MB. Make it smaller and try again.');
    if (!alt) back('Describe the picture in a few words. It is read aloud for people who cannot see it.');
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    imagePath = `${randomUUID()}.${ext}`;
    const up = await db.storage.from(ANN_BUCKET).upload(imagePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (up.error) back('Could not upload the picture. Check that the database step was run.');
  }
  if (style === 'picture' && !imagePath) back('The "Your design" style needs a picture.');

  const { data, error } = await db.from('announcements').insert({
    title, body, button_text: buttonText, button_href: href, style, color, image_path: imagePath, image_alt: imagePath ? alt : '', image_mode: imageMode,
    role, zips, activity, status: publish ? 'live' : 'draft', ends_at: ends, created_by: me.id,
  }).select('id').single();
  if (error || !data) {
    if (imagePath) await db.storage.from(ANN_BUCKET).remove([imagePath]);
    back('Could not save. Check that the database step was run.');
  }
  await audit(me, publish ? 'announcement_publish' : 'announcement_draft', { type: 'announcement', id: (data as any).id }, { title, role, zips: zips.length, activity });
  revalidatePath('/admin/announcements');
  redirect(`/admin/announcements?ok=${encodeURIComponent(publish ? 'Published. People in the group will see it next time they open Projects.' : 'Saved as a draft.')}`);
}

export async function setAnnouncementStatus(f: FormData) {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'id');
  const status = str(f, 'status');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['draft', 'live', 'ended'].includes(status)) return;
  await db.from('announcements').update({ status }).eq('id', id);
  await audit(me, `announcement_${status}`, { type: 'announcement', id }, {});
  revalidatePath('/admin/announcements');
}

export async function deleteAnnouncement(f: FormData) {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const { data: a } = await db.from('announcements').select('image_path,title').eq('id', id).maybeSingle<any>();
  if (a?.image_path) await db.storage.from(ANN_BUCKET).remove([a.image_path]);
  await db.from('announcements').delete().eq('id', id);
  await audit(me, 'announcement_delete', { type: 'announcement', id }, { title: a?.title ?? '' });
  revalidatePath('/admin/announcements');
}
