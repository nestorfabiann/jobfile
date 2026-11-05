'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';
import { finishAsked, finishRequestsToday, MAX_FINISH_REQUESTS_PER_DAY } from '@/lib/finishRequest';

/** The contractor side moves the job into closeout, then marks it complete. */
export async function setStage(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const to = String(formData.get('to') ?? '');
  const { role, user, project } = await loadProject(projectId);
  if (role !== 'contractor') return;
  const admin = supabaseAdmin();

  const { data: agr } = await admin.from('agreements').select('executed_at').eq('project_id', project.id).maybeSingle();
  if (!agr?.executed_at) return;

  const now = new Date().toISOString();
  let title = '';
  let body = '';
  if (to === 'closeout' && !project.closeout_started_at) {
    await admin.from('projects').update({ closeout_started_at: now }).eq('id', project.id);
    title = 'Closeout started on';
    body = 'The work is substantially done. Use the Photos tab for the final walkthrough punch list and the Payments tab for the final payment.';
  } else if (to === 'complete' && !project.completed_at) {
    // Closeout is optional: the contractor can mark the job complete straight from active.
    await admin.from('projects').update({ completed_at: now, closeout_started_at: project.closeout_started_at ?? now }).eq('id', project.id);
    title = 'Project marked complete:';
    body = 'The contractor marked this project complete. Open the Ratings tab to rate your experience. Ratings are shown once you both rate.';
  } else if (to === 'reopen' && (project.closeout_started_at || project.completed_at)) {
    await admin.from('projects').update({ closeout_started_at: null, completed_at: null }).eq('id', project.id);
    title = 'Project moved back to active:';
    body = 'The contractor moved this project back to active.';
  } else return;

  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'stage',
    title: (n) => `${title} ${n}`,
    body,
  });
  revalidatePath(`/projects/${project.id}`, 'layout');
  // Take the contractor straight to the rating form.
  if (to === 'complete') redirect(`/projects/${project.id}/rating?done=1`);
}


/** The homeowner asks the contractor to mark the job complete. Up to 3 times a day per project. */
export async function requestFinish(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const { role, user, project } = await loadProject(projectId);
  if (role !== 'homeowner' || project.completed_at) return;
  const admin = supabaseAdmin();
  const { data: agr } = await admin.from('agreements').select('executed_at').eq('project_id', project.id).maybeSingle();
  if (!agr?.executed_at) return;
  if (await finishAsked(project.id)) return;
  if ((await finishRequestsToday(project.id)) >= MAX_FINISH_REQUESTS_PER_DAY) return;
  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'finish_request',
    title: (n) => `The homeowner says the work is finished on ${n}`,
    body: 'Open the project and mark it complete if the work is done. Marking it complete opens ratings for both sides.',
  });
  revalidatePath(`/projects/${project.id}`, 'layout');
}

/** The homeowner takes back a "the work is finished" request that is still waiting on the contractor. */
export async function cancelFinish(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const { role, user, project } = await loadProject(projectId);
  if (role !== 'homeowner' || project.completed_at) return;
  if (!(await finishAsked(project.id))) return;
  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'finish_cancel',
    title: (n) => `The homeowner took back the finished request on ${n}`,
    body: 'The work is not marked finished yet. Nothing for you to do.',
  });
  revalidatePath(`/projects/${project.id}`, 'layout');
}
