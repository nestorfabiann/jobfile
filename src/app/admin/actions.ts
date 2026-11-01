'use server';

import { revalidatePath } from 'next/cache';
import { audit, isAdminEmail, requireAdmin } from '@/lib/admin';
import { notifyUsers } from '@/lib/notify';
import { supabaseAdmin } from '@/lib/supabase/server';

export type Result = { ok: true; message: string } | { ok: false; error: string };
const MAX_RECIPIENTS = 200;

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function banUser(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'user_id');
  const reason = str(f, 'reason').slice(0, 500);
  if (!id) return { ok: false, error: 'No user selected.' };
  if (id === me.id) return { ok: false, error: 'You cannot suspend yourself.' };
  if (!reason) return { ok: false, error: 'Add a short reason. It goes in the audit log.' };

  const { data: prof } = await db.from('profiles').select('email').eq('id', id).maybeSingle();
  if (!prof) return { ok: false, error: 'User not found.' };
  if (isAdminEmail(prof.email)) return { ok: false, error: 'Admin accounts cannot be suspended here.' };

  // Block new sign-ins and token refreshes at Supabase, and flag the profile so existing sessions are stopped by the app.
  const { error } = await db.auth.admin.updateUserById(id, { ban_duration: '876000h' });
  if (error) return { ok: false, error: `Could not suspend: ${error.message}` };
  await db.from('profiles').update({ banned_at: new Date().toISOString(), ban_reason: reason }).eq('id', id);
  await audit(me, 'ban', { type: 'user', id }, { email: prof.email, reason });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: `${prof.email} is suspended.` };
}

export async function unbanUser(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'user_id');
  if (!id) return { ok: false, error: 'No user selected.' };
  const { data: prof } = await db.from('profiles').select('email').eq('id', id).maybeSingle();
  if (!prof) return { ok: false, error: 'User not found.' };
  const { error } = await db.auth.admin.updateUserById(id, { ban_duration: 'none' });
  if (error) return { ok: false, error: `Could not restore: ${error.message}` };
  await db.from('profiles').update({ banned_at: null, ban_reason: '' }).eq('id', id);
  await audit(me, 'unban', { type: 'user', id }, { email: prof.email });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: `${prof.email} is restored.` };
}

/** Everyone attached to a project: homeowner(s), direct members and company staff. */
async function projectUserIds(projectId: string): Promise<string[]> {
  const db = supabaseAdmin();
  const { data: p } = await db.from('projects').select('company_id').eq('id', projectId).maybeSingle();
  if (!p) return [];
  const [{ data: pm }, { data: cm }] = await Promise.all([
    db.from('project_members').select('user_id').eq('project_id', projectId),
    db.from('company_members').select('user_id').eq('company_id', p.company_id),
  ]);
  return Array.from(new Set([...(pm ?? []), ...(cm ?? [])].map((r) => r.user_id as string)));
}

async function audienceIds(audience: string, target: string): Promise<string[]> {
  const db = supabaseAdmin();
  const ids = async (q: PromiseLike<{ data: { [k: string]: unknown }[] | null }>, col: string) =>
    ((await q).data ?? []).map((r) => r[col] as string);

  if (audience === 'user') return target ? [target] : [];
  if (audience === 'project') return target ? projectUserIds(target) : [];
  if (audience === 'everyone') return ids(db.from('profiles').select('id').is('banned_at', null), 'id');

  const contractors = new Set([
    ...(await ids(db.from('company_members').select('user_id'), 'user_id')),
    ...(await ids(db.from('project_members').select('user_id').eq('role', 'contractor'), 'user_id')),
  ]);
  if (audience === 'contractors') return Array.from(contractors);
  if (audience === 'homeowners') {
    const h = await ids(db.from('project_members').select('user_id').eq('role', 'homeowner'), 'user_id');
    return Array.from(new Set(h)).filter((id) => !contractors.has(id));
  }
  return [];
}

async function send(ids: string[], title: string, body: string, projectId: string | null, force: boolean) {
  // Small batches keep us under email provider rate limits and the function time limit.
  for (let i = 0; i < ids.length; i += 10) {
    await notifyUsers({ userIds: ids.slice(i, i + 10), projectId, kind: 'admin', title, body, force });
  }
}

export async function sendBroadcast(_: Result | null, f: FormData): Promise<Result> {
  const { user: me } = await requireAdmin();
  const audience = str(f, 'audience');
  const target = str(f, 'target');
  const title = str(f, 'title').slice(0, 120);
  const body = str(f, 'body').slice(0, 2000);
  const force = f.get('force') === 'on';
  if (!['everyone', 'contractors', 'homeowners', 'project', 'user'].includes(audience)) return { ok: false, error: 'Pick who gets this.' };
  if ((audience === 'project' || audience === 'user') && !target) return { ok: false, error: 'Choose the project or user.' };
  if (!title || !body) return { ok: false, error: 'Add a subject and a message.' };

  const ids = (await audienceIds(audience, target)).filter((id) => id !== me.id);
  if (!ids.length) return { ok: false, error: 'No one matches that audience.' };
  if (ids.length > MAX_RECIPIENTS)
    return { ok: false, error: `That is ${ids.length} people. The limit is ${MAX_RECIPIENTS} per send. Narrow the audience.` };

  await send(ids, title, body, audience === 'project' ? target : null, force);
  await audit(me, 'broadcast', { type: audience, id: target }, { title, recipients: ids.length, force });
  revalidatePath('/admin/audit');
  return { ok: true, message: `Sent to ${ids.length} ${ids.length === 1 ? 'person' : 'people'}.` };
}

/** Review moderation. Hide for rule violations (abuse, personal details, off-topic, fake), never for a low rating alone. */
export async function hideReview(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'review_id');
  const reason = str(f, 'reason').slice(0, 500);
  if (!id) return { ok: false, error: 'No review selected.' };
  if (!reason) return { ok: false, error: 'Write the reason. It goes in the audit log.' };
  const { error } = await db.from('reviews').update({ hidden_at: new Date().toISOString(), hidden_reason: reason }).eq('id', id);
  if (error) return { ok: false, error: `Could not hide: ${error.message}` };
  await audit(me, 'hide_review', { type: 'review', id }, { reason });
  revalidatePath('/admin/reviews');
  return { ok: true, message: 'Review hidden.' };
}

export async function restoreReview(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'review_id');
  const dismiss = f.get('dismiss') === '1';
  const patch = dismiss
    ? { reported_at: null, reported_by: null, report_reason: '' }
    : { hidden_at: null, hidden_reason: '', reported_at: null, reported_by: null, report_reason: '' };
  const { error } = await db.from('reviews').update(patch).eq('id', id);
  if (error) return { ok: false, error: `Could not update: ${error.message}` };
  await audit(me, dismiss ? 'dismiss_report' : 'restore_review', { type: 'review', id });
  revalidatePath('/admin/reviews');
  return { ok: true, message: dismiss ? 'Report dismissed. The review stays visible.' : 'Review restored.' };
}

/** Approve or reject an insurance certificate. The contractor is told either way. */
export async function reviewInsurance(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'id');
  const decision = str(f, 'decision');
  const note = str(f, 'note').slice(0, 300);
  if (!id || (decision !== 'approved' && decision !== 'rejected')) return { ok: false, error: 'Nothing to review.' };
  if (decision === 'rejected' && !note) return { ok: false, error: 'Tell the contractor why. They will see this note.' };
  const { data: ins } = await db.from('company_insurance').select('id,company_id,kind,expires_on,status').eq('id', id).maybeSingle();
  if (!ins) return { ok: false, error: 'Certificate not found.' };
  if (decision === 'approved' && (ins.expires_on as string) < new Date().toISOString().slice(0, 10)) return { ok: false, error: 'That policy has already expired. Reject it.' };
  const { error } = await db
    .from('company_insurance')
    .update({ status: decision, review_note: decision === 'rejected' ? note : '', reviewed_by: me.id, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: `Could not save: ${error.message}` };
  await audit(me, decision === 'approved' ? 'insurance_approve' : 'insurance_reject', { type: 'company', id: ins.company_id as string }, { kind: ins.kind, note });
  const { data: owners } = await db.from('company_members').select('user_id').eq('company_id', ins.company_id as string).eq('role', 'owner');
  await notifyUsers({
    userIds: (owners ?? []).map((o) => o.user_id as string),
    projectId: null,
    kind: 'admin',
    title: decision === 'approved' ? 'Your insurance was verified' : 'Your insurance certificate needs another look',
    body: decision === 'approved' ? 'The Insurance verified badge now shows on your public profile.' : `Reason: ${note}. Open Settings, Business profile to upload a new one.`,
    force: true,
  });
  revalidatePath('/admin/verification');
  return { ok: true, message: decision === 'approved' ? 'Approved. The badge is live.' : 'Rejected. The contractor was told why.' };
}
