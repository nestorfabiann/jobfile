'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';
import { fmtRange, starterPhases } from '@/lib/schedule';

const page = (id: string, q = '') => `/projects/${id}/schedule${q}`;
function fail(id: string, msg: string): never {
  redirect(page(id, `?error=${encodeURIComponent(msg)}`));
}
const date = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
const txt = (f: FormData, k: string, n: number) => String(f.get(k) ?? '').trim().slice(0, n);

async function ctx(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const c = await loadProject(projectId);
  if (c.role !== 'contractor') fail(c.project.id, 'Only the contractor can change the schedule.');
  return { ...c, admin: supabaseAdmin() };
}
async function phaseOf(admin: ReturnType<typeof supabaseAdmin>, projectId: string, id: string) {
  const { data } = await admin.from('project_phases').select('*').eq('id', id).eq('project_id', projectId).maybeSingle();
  if (!data) fail(projectId, 'That phase was not found.');
  return data as any;
}
const done = (id: string): never => {
  revalidatePath(page(id));
  revalidatePath(`/projects/${id}/overview`);
  redirect(page(id));
};

export async function addPhase(formData: FormData) {
  const { project, admin } = await ctx(formData);
  const title = txt(formData, 'title', 120);
  if (!title) fail(project.id, 'Give the phase a name.');
  const starts = date(formData, 'starts_on');
  const ends = date(formData, 'ends_on');
  if (starts && ends && ends < starts) fail(project.id, 'The end date is before the start date.');
  const { data: last } = await admin.from('project_phases').select('position').eq('project_id', project.id).order('position', { ascending: false }).limit(1).maybeSingle();
  const { error } = await admin.from('project_phases').insert({ project_id: project.id, title, note: txt(formData, 'note', 300), starts_on: starts, ends_on: ends, position: ((last?.position as number | undefined) ?? -1) + 1 });
  if (error) fail(project.id, 'Could not save the phase. Check that the database step was run.');
  done(project.id);
}

/** Four starter phases spread between the agreement's start and completion dates. */
export async function makeStarter(formData: FormData) {
  const { project, admin } = await ctx(formData);
  const { count } = await admin.from('project_phases').select('id', { count: 'exact', head: true }).eq('project_id', project.id);
  if ((count ?? 0) > 0) fail(project.id, 'This project already has phases.');
  const { data: agr } = await admin.from('agreements').select('start_date,end_date').eq('project_id', project.id).maybeSingle();
  if (!agr?.start_date || !agr?.end_date) fail(project.id, 'Set the start and completion dates in the agreement first, or add phases yourself.');
  const rows = starterPhases(agr.start_date as string, agr.end_date as string).map((p, position) => ({ ...p, position, project_id: project.id }));
  const { error } = await admin.from('project_phases').insert(rows);
  if (error) fail(project.id, 'Could not create the schedule. Check that the database step was run.');
  done(project.id);
}

export async function setPhaseStatus(formData: FormData) {
  const { project, admin, role, user } = await ctx(formData);
  const ph = await phaseOf(admin, project.id, String(formData.get('id') ?? ''));
  const status = String(formData.get('status') ?? '');
  if (!['upcoming', 'in_progress', 'done'].includes(status)) fail(project.id, 'Unknown status.');
  await admin.from('project_phases').update({ status }).eq('id', ph.id);
  if (status === 'done') {
    await notifyOtherSide({ projectId: project.id, senderId: user.id, senderRole: role, kind: 'schedule', throttle: true, title: (n) => `${ph.title} is done on ${n}`, body: 'Open the Schedule tab to see what is next.' });
  }
  done(project.id);
}

/** Moving dates needs a reason. The change is logged and the homeowner is told. */
export async function changePhaseDates(formData: FormData) {
  const { project, admin, role, user } = await ctx(formData);
  const ph = await phaseOf(admin, project.id, String(formData.get('id') ?? ''));
  const starts = date(formData, 'starts_on');
  const ends = date(formData, 'ends_on');
  if (starts && ends && ends < starts) fail(project.id, 'The end date is before the start date.');
  if (starts === ph.starts_on && ends === ph.ends_on) fail(project.id, 'Those are the same dates.');
  const reason = txt(formData, 'reason', 500);
  if (!reason) fail(project.id, 'Say why the dates are changing. Both sides see the reason.');
  await admin.from('project_phases').update({ starts_on: starts, ends_on: ends }).eq('id', ph.id);
  const summary = `${ph.title}: ${fmtRange(ph.starts_on, ph.ends_on)} moved to ${fmtRange(starts, ends)}`;
  await admin.from('schedule_changes').insert({ project_id: project.id, phase_id: ph.id, summary, reason, changed_by: user.id, changed_role: role });
  await notifyOtherSide({ projectId: project.id, senderId: user.id, senderRole: role, kind: 'schedule', title: (n) => `Schedule changed on ${n}`, body: `${summary}. Reason: ${reason}` });
  done(project.id);
}

export async function deletePhase(formData: FormData) {
  const { project, admin } = await ctx(formData);
  await admin.from('project_phases').delete().eq('id', String(formData.get('id') ?? '')).eq('project_id', project.id);
  done(project.id);
}
