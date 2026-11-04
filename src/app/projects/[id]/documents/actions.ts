'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';

const BUCKET = 'project-docs';
const MAX_BYTES = 4_000_000;
const MAX_DOCS = 60;
const TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const KINDS = ['permit', 'insurance', 'receipt', 'warranty', 'other'];

const page = (id: string, q = '') => `/projects/${id}/documents${q}`;
function fail(id: string, msg: string): never {
  redirect(page(id, `?error=${encodeURIComponent(msg)}`));
}

export async function uploadDocument(formData: FormData) {
  const { role, user, project } = await loadProject(String(formData.get('project_id') ?? ''));
  const admin = supabaseAdmin();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) fail(project.id, 'Choose a file to add.');
  const ext = TYPES[(file as File).type];
  if (!ext) fail(project.id, 'Add a PDF, JPEG, PNG or WebP file.');
  if ((file as File).size > MAX_BYTES) fail(project.id, 'That file is over 4 MB. Shrink it or save it as a smaller PDF.');
  const kind = KINDS.includes(String(formData.get('kind'))) ? String(formData.get('kind')) : 'other';
  const title = String(formData.get('title') ?? '').trim().slice(0, 120) || (file as File).name.slice(0, 120);
  const { count } = await admin.from('project_documents').select('id', { count: 'exact', head: true }).eq('project_id', project.id);
  if ((count ?? 0) >= MAX_DOCS) fail(project.id, 'This project has reached its document limit. Remove one first.');

  const path = `${project.id}/${randomUUID()}.${ext}`;
  const up = await admin.storage.from(BUCKET).upload(path, Buffer.from(await (file as File).arrayBuffer()), { contentType: (file as File).type, upsert: false });
  if (up.error) fail(project.id, 'Could not store the file. Check that the database step was run.');
  const { error } = await admin.from('project_documents').insert({
    project_id: project.id, kind, title, note: String(formData.get('note') ?? '').trim().slice(0, 300), path, file_type: (file as File).type, uploaded_by: user.id, uploader_role: role,
  });
  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    fail(project.id, 'Could not save the document.');
  }
  await notifyOtherSide({ projectId: project.id, senderId: user.id, senderRole: role, kind: 'document', throttle: true, title: (n) => `New document on ${n}: ${title}`, body: 'Open the Documents tab to see it.' });
  revalidatePath(page(project.id));
  redirect(page(project.id));
}

export async function deleteDocument(formData: FormData) {
  const { role, user, project } = await loadProject(String(formData.get('project_id') ?? ''));
  const admin = supabaseAdmin();
  const { data: d } = await admin.from('project_documents').select('*').eq('id', String(formData.get('id') ?? '')).eq('project_id', project.id).maybeSingle();
  if (!d) fail(project.id, 'That document was not found.');
  if (role !== 'contractor' && d.uploaded_by !== user.id) fail(project.id, 'Only the person who added it, or the contractor, can remove it.');
  await admin.storage.from(BUCKET).remove([d.path as string]);
  await admin.from('project_documents').delete().eq('id', d.id);
  revalidatePath(page(project.id));
  redirect(page(project.id));
}
