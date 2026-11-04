'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';
import { fmtDay } from '@/lib/schedule';

const page = (id: string, q = '') => `/projects/${id}/selections${q}`;
function fail(id: string, msg: string): never {
  redirect(page(id, `?error=${encodeURIComponent(msg)}`));
}
const txt = (f: FormData, k: string, n: number) => String(f.get(k) ?? '').trim().slice(0, n);
const done = (id: string): never => {
  revalidatePath(page(id));
  redirect(page(id));
};
async function load(formData: FormData) {
  const c = await loadProject(String(formData.get('project_id') ?? ''));
  const admin = supabaseAdmin();
  const { data: sel } = await admin.from('selections').select('*').eq('id', String(formData.get('id') ?? '')).eq('project_id', c.project.id).maybeSingle();
  if (!sel) fail(c.project.id, 'That selection was not found.');
  return { ...c, admin, sel: sel as any };
}

/** The contractor lists a choice the homeowner needs to make. */
export async function addSelection(formData: FormData) {
  const { role, user, project } = await loadProject(String(formData.get('project_id') ?? ''));
  if (role !== 'contractor') fail(project.id, 'Only the contractor adds selections.');
  const title = txt(formData, 'title', 120);
  if (!title) fail(project.id, 'Say what needs to be chosen.');
  const needed = String(formData.get('needed_by') ?? '').trim();
  const needed_by = /^\d{4}-\d{2}-\d{2}$/.test(needed) ? needed : null;
  const { error } = await supabaseAdmin().from('selections').insert({ project_id: project.id, title, note: txt(formData, 'note', 500), affects: txt(formData, 'affects', 120), needed_by, created_by: user.id });
  if (error) fail(project.id, 'Could not save the selection. Check that the database step was run.');
  await notifyOtherSide({ projectId: project.id, senderId: user.id, senderRole: role, kind: 'selection', title: (n) => `A choice is needed on ${n}: ${title}`, body: needed_by ? `Please choose by ${fmtDay(needed_by)}. Open the Selections tab.` : 'Open the Selections tab to choose.' });
  done(project.id);
}

/** The homeowner says what they chose. */
export async function chooseSelection(formData: FormData) {
  const { role, user, project, admin, sel } = await load(formData);
  if (role !== 'homeowner') fail(project.id, 'Only the homeowner makes the choice.');
  if (sel.status === 'chosen') fail(project.id, 'That choice was already made.');
  const choice = txt(formData, 'choice', 300);
  if (!choice) fail(project.id, 'Write what you chose, for example the color or product name.');
  await admin.from('selections').update({ status: 'chosen', choice, link: txt(formData, 'link', 500), chosen_by: user.id, chosen_at: new Date().toISOString() }).eq('id', sel.id);
  await notifyOtherSide({ projectId: project.id, senderId: user.id, senderRole: role, kind: 'selection', title: (n) => `Chosen on ${n}: ${sel.title}`, body: choice });
  done(project.id);
}

/** The contractor can reopen a choice, for example if an item is unavailable. */
export async function reopenSelection(formData: FormData) {
  const { role, user, project, admin, sel } = await load(formData);
  if (role !== 'contractor') fail(project.id, 'Only the contractor can reopen a choice.');
  await admin.from('selections').update({ status: 'open', chosen_by: null, chosen_at: null }).eq('id', sel.id);
  await notifyOtherSide({ projectId: project.id, senderId: user.id, senderRole: role, kind: 'selection', title: (n) => `Please choose again on ${n}: ${sel.title}`, body: txt(formData, 'why', 300) || 'Open the Selections tab.' });
  done(project.id);
}

export async function deleteSelection(formData: FormData) {
  const { role, project, admin, sel } = await load(formData);
  if (role !== 'contractor') fail(project.id, 'Only the contractor can remove a selection.');
  await admin.from('selections').delete().eq('id', sel.id);
  done(project.id);
}
