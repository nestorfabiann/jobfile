'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';
import { describeFix, FIXES, ISSUE_CATEGORIES, MAX_OPEN_ISSUES, MAX_REPORTS_PER_DAY, RESPOND_DAYS, type Issue } from '@/lib/issues';
import { dollars } from '@/lib/money';
import { suggestFixes } from '@/lib/issueAI';

const money = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? '').replace(/[$,\s]/g, '');
  if (!s) return null;
  const n = Math.round(parseFloat(s) * 100);
  return Number.isFinite(n) && n >= 0 && n < 100_000_000 ? n : null;
};
const txt = (f: FormData, k: string, n: number) => String(f.get(k) ?? '').trim().slice(0, n);
const go = (path: string, m: string, kind: 'error' | 'ok' = 'error'): never => redirect(`${path}?${kind}=${encodeURIComponent(m)}`);

async function issueFor(projectId: string, issueId: string): Promise<Issue | null> {
  const { data } = await supabaseAdmin().from('project_issues').select('*').eq('id', issueId).eq('project_id', projectId).maybeSingle<any>();
  return (data as Issue) ?? null;
}

export type ReportResult = { ok: true; id: string } | { ok: false; error: string };

/** Either side reports a problem. The other side is told and has a few days to answer. Photos are uploaded right after, one request each. */
export async function reportIssue(formData: FormData): Promise<ReportResult> {
  try {
    const projectId = String(formData.get('project_id') ?? '');
    const { role, user, project } = await loadProject(projectId);
    const base = `/projects/${project.id}/issues`;
    const category = String(formData.get('category') ?? '');
    if (!ISSUE_CATEGORIES.some((c) => c[0] === category)) return { ok: false, error: 'Pick what kind of problem it is.' };
    const description = txt(formData, 'description', 2000);
    if (description.length < 10) return { ok: false, error: 'Say a little more about what happened (at least a sentence).' };
    const wantsRaw = String(formData.get('wants') ?? '');
    const wants = FIXES.some((f) => f[0] === wantsRaw && f[0] !== 'disagree') ? wantsRaw : '';
    const db = supabaseAdmin();
    const { count: open } = await db.from('project_issues').select('id', { count: 'exact', head: true }).eq('project_id', project.id).eq('status', 'open');
    if ((open ?? 0) >= MAX_OPEN_ISSUES) return { ok: false, error: `There are already ${MAX_OPEN_ISSUES} open problems on this project. Settle one first.` };
    const since = new Date(Date.now() - 86400_000).toISOString();
    const { count: today } = await db.from('project_issues').select('id', { count: 'exact', head: true }).eq('reporter_id', user.id).gte('created_at', since);
    if ((today ?? 0) >= MAX_REPORTS_PER_DAY) return { ok: false, error: 'That is a lot of reports for one day. Try again tomorrow.' };

    const ai = await suggestFixes({ category, description, wants, projectName: project.name as string, reporterRole: role });
    const { data: row, error } = await db.from('project_issues').insert({
      project_id: project.id, reporter_id: user.id, reporter_role: role, category, description, wants,
      respond_by: new Date(Date.now() + RESPOND_DAYS * 86400_000).toISOString(), ai_options: ai,
    }).select('id').single<any>();
    if (error || !row) return { ok: false, error: 'Could not save. Check that the database step was run.' };
    await db.from('issue_events').insert([
      { issue_id: row.id, project_id: project.id, user_id: user.id, side: role, kind: 'report', body: description },
      ...(wants ? [{ issue_id: row.id, project_id: project.id, user_id: user.id, side: role, kind: 'proposal', fix: wants, body: '' }] : []),
    ]);
    await notifyOtherSide({
      projectId: project.id, senderId: user.id, senderRole: role, kind: 'issue',
      title: (n) => `${role === 'homeowner' ? 'The homeowner' : 'The contractor'} reported a problem on ${n}`,
      body: `You have ${RESPOND_DAYS} days to answer. Open it to see what happened and suggest a fix.`,
    });
    revalidatePath(base);
    return { ok: true, id: row.id as string };
  } catch {
    return { ok: false, error: 'Something went wrong. Try again.' };
  }
}

const PHOTO_BUCKET = 'project-photos';
const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_ISSUE_PHOTOS = 10;
export type PhotoResult = { ok: true } | { ok: false; error: string };

/** One photo on a reported problem. Either side can add while it is open. The browser shrinks it first. */
export async function uploadIssuePhoto(formData: FormData): Promise<PhotoResult> {
  try {
    const projectId = String(formData.get('project_id') ?? '');
    const issueId = String(formData.get('issue_id') ?? '');
    const { role, user, project } = await loadProject(projectId);
    const issue = await issueFor(project.id, issueId);
    if (!issue || issue.status !== 'open') return { ok: false, error: 'This problem is closed.' };
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'No photo was received.' };
    const ext = PHOTO_TYPES[file.type];
    if (!ext) return { ok: false, error: 'Photos must be JPEG, PNG or WebP.' };
    if (file.size > 3_500_000) return { ok: false, error: 'That photo is too large even after shrinking.' };
    const db = supabaseAdmin();
    const { count } = await db.from('issue_photos').select('id', { count: 'exact', head: true }).eq('issue_id', issueId);
    if ((count ?? 0) >= MAX_ISSUE_PHOTOS) return { ok: false, error: `Up to ${MAX_ISSUE_PHOTOS} photos on one problem.` };
    const path = `${project.id}/issue-${issueId}-${randomUUID()}.${ext}`;
    const up = await db.storage.from(PHOTO_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (up.error) return { ok: false, error: 'Could not store the photo.' };
    const { error } = await db.from('issue_photos').insert({ issue_id: issueId, project_id: project.id, uploaded_by: user.id, side: role, path });
    if (error) {
      await db.storage.from(PHOTO_BUCKET).remove([path]);
      return { ok: false, error: 'Could not save the photo. Check that the database step was run.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong saving that photo.' };
  }
}

/** The person who added a photo can remove it while the problem is open. */
export async function deleteIssuePhoto(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const issueId = String(formData.get('issue_id') ?? '');
  const photoId = String(formData.get('photo_id') ?? '');
  const { user, project } = await loadProject(projectId);
  const issue = await issueFor(project.id, issueId);
  if (!issue || issue.status !== 'open') return;
  const db = supabaseAdmin();
  const { data: ph } = await db.from('issue_photos').select('id,path,uploaded_by').eq('id', photoId).eq('issue_id', issueId).maybeSingle<any>();
  if (!ph || ph.uploaded_by !== user.id) return;
  await db.storage.from(PHOTO_BUCKET).remove([ph.path as string]);
  await db.from('issue_photos').delete().eq('id', photoId);
  revalidatePath(`/projects/${project.id}/issues/${issueId}`);
}

/** Propose a fix, or explain a different view. Accepting is a separate step by the other side. */
export async function proposeFix(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const issueId = String(formData.get('issue_id') ?? '');
  const { role, user, project } = await loadProject(projectId);
  const path = `/projects/${project.id}/issues/${issueId}`;
  const issue = await issueFor(project.id, issueId);
  if (!issue) redirect(`/projects/${project.id}/issues`);
  if (issue!.status !== 'open') go(path, 'This one is already closed.');
  const fix = String(formData.get('fix') ?? '');
  if (!FIXES.some((f) => f[0] === fix)) go(path, 'Pick an answer.');
  const amount = money(formData.get('amount'));
  const date = String(formData.get('on_date') ?? '');
  const body = txt(formData, 'body', 1500);
  if ((fix === 'credit' || fix === 'balance' || fix === 'price') && amount == null) go(path, 'Enter an amount for that fix.');
  if (fix === 'redo' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) go(path, 'Pick the date the work will be redone by.');
  if (fix === 'disagree' && body.length < 5) go(path, 'Explain how you see it.');
  const db = supabaseAdmin();
  const ev = { fix, amount_cents: ['credit', 'balance', 'price'].includes(fix) ? amount : null, on_date: fix === 'redo' ? date : null, body };
  await db.from('issue_events').insert({ issue_id: issueId, project_id: project.id, user_id: user.id, side: role, kind: fix === 'disagree' ? 'note' : 'proposal', ...ev });
  await db.from('project_issues').update({ updated_at: new Date().toISOString() }).eq('id', issueId);
  await notifyOtherSide({
    projectId: project.id, senderId: user.id, senderRole: role, kind: 'issue',
    title: (n) => `${role === 'homeowner' ? 'The homeowner' : 'The contractor'} answered the problem on ${n}`,
    body: fix === 'disagree' ? 'They see it differently. Open it to read their side.' : `Proposed: ${describeFix({ ...ev, fix })}. Open it to accept or answer.`,
  });
  revalidatePath(path);
  redirect(`${path}?ok=${encodeURIComponent('Sent.')}`);
}

/** The other side accepts a proposal. The agreed fix is recorded in the project messages. */
export async function acceptFix(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const issueId = String(formData.get('issue_id') ?? '');
  const eventId = String(formData.get('event_id') ?? '');
  const { role, user, project } = await loadProject(projectId);
  const path = `/projects/${project.id}/issues/${issueId}`;
  const issue = await issueFor(project.id, issueId);
  if (!issue || issue.status !== 'open') go(path, 'This one is already closed.');
  const db = supabaseAdmin();
  const { data: ev } = await db.from('issue_events').select('*').eq('id', eventId).eq('issue_id', issueId).eq('kind', 'proposal').maybeSingle<any>();
  if (!ev) go(path, 'That proposal was not found.');
  if (ev.side === role) go(path, 'The other side has to accept your proposal.');
  const summary = describeFix(ev);
  const now = new Date().toISOString();
  await db.from('issue_events').insert({ issue_id: issueId, project_id: project.id, user_id: user.id, side: role, kind: 'accept', ref_id: eventId, body: summary });
  await db.from('project_issues').update({ status: 'agreed', agreed_summary: summary, agreed_at: now, updated_at: now }).eq('id', issueId);
  await db.from('messages').insert({
    project_id: project.id, sender_id: user.id, sender_role: role, tag: 'decision',
    body: `Problem settled (${issue!.category}). Agreed fix: ${summary}.${ev.amount_cents != null ? ` If the price changes, add it in Changes.` : ''}`.slice(0, 4000),
  });
  await notifyOtherSide({
    projectId: project.id, senderId: user.id, senderRole: role, kind: 'issue',
    title: (n) => `The problem on ${n} is settled`,
    body: `Agreed fix: ${summary}. It is saved in the project messages.`,
  });
  revalidatePath(path);
  revalidatePath(`/projects/${project.id}`, 'layout');
  redirect(`${path}?ok=${encodeURIComponent('Agreed. It is saved in the project messages.')}`);
}

/** The person who reported it can withdraw it. */
export async function withdrawIssue(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const issueId = String(formData.get('issue_id') ?? '');
  const { role, user, project } = await loadProject(projectId);
  const path = `/projects/${project.id}/issues/${issueId}`;
  const issue = await issueFor(project.id, issueId);
  if (!issue || issue.status !== 'open') go(path, 'This one is already closed.');
  if (issue!.reporter_id !== user.id) go(path, 'Only the person who reported it can withdraw it.');
  const db = supabaseAdmin();
  await db.from('project_issues').update({ status: 'withdrawn', updated_at: new Date().toISOString() }).eq('id', issueId);
  await db.from('issue_events').insert({ issue_id: issueId, project_id: project.id, user_id: user.id, side: role, kind: 'withdraw', body: 'Withdrawn' });
  await notifyOtherSide({
    projectId: project.id, senderId: user.id, senderRole: role, kind: 'issue',
    title: (n) => `The problem on ${n} was withdrawn`, body: 'Nothing for you to do.',
  });
  revalidatePath(path);
  redirect(`${path}?ok=${encodeURIComponent('Withdrawn.')}`);
}

/** Either side asks a Jobfile mediator to look. Allowed after the answer deadline, or once both sides have proposed. */
export async function askJobfile(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const issueId = String(formData.get('issue_id') ?? '');
  const { role, user, project } = await loadProject(projectId);
  const path = `/projects/${project.id}/issues/${issueId}`;
  const issue = await issueFor(project.id, issueId);
  if (!issue || issue.status !== 'open') go(path, 'This one is already closed.');
  if (issue!.escalated_at) go(path, 'Jobfile has already been asked to look.');
  const db = supabaseAdmin();
  const { data: evs } = await db.from('issue_events').select('side,kind').eq('issue_id', issueId);
  const sides = new Set(((evs ?? []) as any[]).filter((e) => e.kind === 'proposal' || e.kind === 'note').map((e) => e.side as string));
  const late = Date.now() > new Date(issue!.respond_by).getTime();
  if (!late && sides.size < 2) go(path, 'Give the other side a chance to answer first. You can ask Jobfile to look after the deadline.');
  const now = new Date().toISOString();
  await db.from('project_issues').update({ escalated_at: now, escalated_by: user.id, updated_at: now }).eq('id', issueId);
  await db.from('issue_events').insert({ issue_id: issueId, project_id: project.id, user_id: user.id, side: role, kind: 'escalate', body: 'Asked Jobfile to look' });
  await notifyOtherSide({
    projectId: project.id, senderId: user.id, senderRole: role, kind: 'issue',
    title: (n) => `Jobfile was asked to look at the problem on ${n}`, body: 'A Jobfile mediator will read the record and send a recommendation to both sides.',
  });
  revalidatePath(path);
  redirect(`${path}?ok=${encodeURIComponent('Asked. A Jobfile mediator will read the record and send a recommendation.')}`);
}
