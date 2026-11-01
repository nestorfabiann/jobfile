'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';
import { catsFor, revealedBy } from '@/lib/reviews';

const page = (id: string, q = '') => `/projects/${id}/rating${q}`;
function fail(id: string, m: string): never {
  redirect(page(id, `?error=${encodeURIComponent(m)}`));
}

export async function submitReview(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const { user, project, role, homeownerJoined } = await loadProject(projectId);
  if (!project.completed_at) fail(project.id, 'Ratings open when the contractor marks the project complete.');

  const overall = Math.round(Number(formData.get('overall')));
  if (!(overall >= 1 && overall <= 5)) fail(project.id, 'Tap the stars to give an overall rating.');
  const comment = String(formData.get('comment') ?? '').trim().slice(0, 1000);

  const categories: Record<string, number> = {};
  for (const key of Object.keys(catsFor(role === 'homeowner' ? 'homeowner' : 'contractor'))) {
    const v = Math.round(Number(formData.get(`cat_${key}`)));
    if (v >= 1 && v <= 5) categories[key] = v;
  }

  const admin = supabaseAdmin();
  const { data: rows } = await admin.from('reviews').select('reviewer_role,reviewer_id').eq('project_id', project.id);
  const mine = (rows ?? []).find((r: any) => r.reviewer_role === role);
  const theirs = (rows ?? []).find((r: any) => r.reviewer_role !== role);
  if (mine && revealedBy(project.completed_at, !!theirs)) fail(project.id, 'Ratings are already revealed and can no longer be changed.');
  if (mine && mine.reviewer_id !== user.id) fail(project.id, 'Your side has already rated this project.');

  let subjectUser: string | null = null;
  if (role === 'contractor') {
    if (!homeownerJoined) fail(project.id, 'The homeowner has not signed in to Jobfile, so there is no one to rate yet.');
    const { data: h } = await admin.from('project_members').select('user_id').eq('project_id', project.id).eq('role', 'homeowner').limit(1).maybeSingle();
    subjectUser = (h?.user_id as string | undefined) ?? null;
    if (!subjectUser) fail(project.id, 'The homeowner has not signed in to Jobfile, so there is no one to rate yet.');
  }

  const { error } = await admin.from('reviews').upsert(
    {
      project_id: project.id,
      reviewer_id: user.id,
      reviewer_role: role,
      subject_company_id: role === 'homeowner' ? project.company_id : null,
      subject_user_id: subjectUser,
      overall,
      categories,
      comment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,reviewer_role' },
  );
  if (error) fail(project.id, 'Could not save your rating. Try again.');

  // First rating: ask the other side to rate. Second rating: tell the first person both are now visible.
  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'review',
    title: (name) => (theirs ? `Ratings are now visible: ${name}` : `Rate your experience: ${name}`),
    body: theirs
      ? 'Both of you have rated this project. Open the Ratings tab to see them.'
      : 'The other side has rated this project. Add your rating to see theirs. Ratings are shown together once you both rate.',
  });

  revalidatePath(page(project.id));
  redirect(page(project.id, '?saved=1'));
}

/** The contractor side may reply once, publicly, to a revealed homeowner review of their company. */
export async function replyToReview(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const { project, role } = await loadProject(projectId);
  if (role !== 'contractor') fail(project.id, 'Only the contractor can reply.');
  const reply = String(formData.get('reply') ?? '').trim().slice(0, 600);
  if (!reply) fail(project.id, 'Write a reply first.');

  const admin = supabaseAdmin();
  const { data: rows } = await admin.from('reviews').select('id,reviewer_role,reply,hidden_at').eq('project_id', project.id);
  const review = (rows ?? []).find((r: any) => r.reviewer_role === 'homeowner');
  if (!review || review.hidden_at) fail(project.id, 'There is no review to reply to.');
  if (review.reply) fail(project.id, 'You already replied to this review.');
  if (!revealedBy(project.completed_at, (rows ?? []).some((r: any) => r.reviewer_role === 'contractor'))) fail(project.id, 'You can reply once the ratings are visible.');

  await admin.from('reviews').update({ reply, reply_at: new Date().toISOString() }).eq('id', review.id);
  revalidatePath(page(project.id));
  redirect(page(project.id, '?saved=1'));
}
