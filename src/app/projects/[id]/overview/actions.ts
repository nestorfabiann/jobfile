'use server';

import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';

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
  } else if (to === 'complete' && project.closeout_started_at && !project.completed_at) {
    await admin.from('projects').update({ completed_at: now }).eq('id', project.id);
    title = 'Project marked complete:';
    body = 'The contractor marked this project complete.';
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
}
