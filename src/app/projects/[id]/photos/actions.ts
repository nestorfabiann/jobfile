'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';

const BUCKET = 'project-photos';
const MAX_BYTES = 3_500_000;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export type UploadResult = { ok: true; id?: string } | { ok: false; error: string };

/** Saves one photo. The browser shrinks it first, so each request stays small. */
export async function uploadPhoto(formData: FormData): Promise<UploadResult> {
  try {
    const projectId = String(formData.get('project_id') ?? '');
    const { role, user, project } = await loadProject(projectId);

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'No photo was received.' };
    const ext = TYPES[file.type];
    if (!ext) return { ok: false, error: 'Photos must be JPEG, PNG or WebP.' };
    if (file.size > MAX_BYTES) return { ok: false, error: 'That photo is too large even after shrinking.' };

    const kind = formData.get('kind') === 'fix' ? 'fix' : 'progress';
    const caption = String(formData.get('caption') ?? '').trim().slice(0, 500);
    const path = `${project.id}/${randomUUID()}.${ext}`;

    const admin = supabaseAdmin();
    const up = await admin.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
    if (up.error) return { ok: false, error: 'Could not store the photo. Check that the storage step was run.' };

    const { data: ins, error } = await admin.from('photos').insert({
      project_id: project.id,
      uploaded_by: user.id,
      uploader_role: role,
      kind,
      caption,
      path,
    }).select('id').single();
    if (error) {
      await admin.storage.from(BUCKET).remove([path]);
      return { ok: false, error: 'Could not save the photo record.' };
    }
    return { ok: true, id: ins?.id as string | undefined };
  } catch {
    return { ok: false, error: 'Something went wrong saving that photo.' };
  }
}

/** One alert for the whole batch, sent after the last photo is saved. */
export async function finishUpload(projectId: string, kind: 'progress' | 'fix', count: number, caption: string) {
  if (count < 1) return;
  const { role, user, project } = await loadProject(projectId);
  const n = Math.min(count, 50);
  const noun = n === 1 ? 'photo' : 'photos';
  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'photo',
    title: (name) => (kind === 'fix' ? `${n} ${noun} of details to fix added on ${name}` : `${n} new progress ${noun} on ${name}`),
    body: caption.trim() ? caption.trim().slice(0, 240) : 'Open the Photos tab to see them.',
    throttle: kind === 'progress',
  });
  revalidatePath(`/projects/${project.id}/photos`);
  revalidatePath(`/projects/${project.id}/overview`);
}

/** Contractor marks a detail fixed, the homeowner confirms it or sends it back. */
export async function setFixStatus(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const to = String(formData.get('to') ?? '');
  const { role, user, project } = await loadProject(projectId);
  const admin = supabaseAdmin();

  const { data: ph } = await admin.from('photos').select('id,kind,status,caption').eq('id', id).eq('project_id', project.id).maybeSingle();
  if (!ph || ph.kind !== 'fix') return;

  let next: 'open' | 'fixed' | 'confirmed' | null = null;
  if (to === 'fixed' && role === 'contractor' && ph.status === 'open') next = 'fixed';
  if (to === 'confirmed' && role === 'homeowner' && ph.status === 'fixed') next = 'confirmed';
  if (to === 'open' && role === 'homeowner' && (ph.status === 'fixed' || ph.status === 'confirmed')) next = 'open';
  if (!next) return;

  await admin
    .from('photos')
    .update({ status: next, status_changed_by: user.id, status_changed_at: new Date().toISOString() })
    .eq('id', ph.id);

  const label = ph.caption ? `“${String(ph.caption).slice(0, 80)}”` : 'A detail to fix';
  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'photo',
    title: (name) =>
      next === 'fixed' ? `A detail was marked fixed on ${name}` : next === 'confirmed' ? `A fix was confirmed on ${name}` : `A fix was sent back on ${name}`,
    body:
      next === 'fixed'
        ? `${label} is marked fixed. Open the Photos tab to confirm it or send it back.`
        : next === 'confirmed'
          ? `${label} was confirmed as fixed.`
          : `${label} still needs work.`,
  });
  revalidatePath(`/projects/${project.id}/photos`);
  revalidatePath(`/projects/${project.id}/overview`);
}

/** Whoever uploaded a photo can delete it. */
export async function deletePhoto(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const { user, project } = await loadProject(projectId);
  const admin = supabaseAdmin();
  const { data: ph } = await admin.from('photos').select('id,path,uploaded_by').eq('id', id).eq('project_id', project.id).maybeSingle();
  if (!ph || ph.uploaded_by !== user.id) return;
  await admin.storage.from(BUCKET).remove([ph.path as string]);
  await admin.from('photos').delete().eq('id', ph.id);
  revalidatePath(`/projects/${project.id}/photos`);
  revalidatePath(`/projects/${project.id}/overview`);
}
