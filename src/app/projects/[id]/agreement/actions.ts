'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';
import { parseDollars } from '@/lib/money';
import { agreementIssues, type AgreementRow, type Item, type Milestone } from '@/lib/agreement';

const page = (id: string, q = '') => `/projects/${id}/agreement${q}`;
function fail(id: string, msg: string): never {
  redirect(page(id, `?error=${encodeURIComponent(msg)}`));
}

async function context(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const c = await loadProject(projectId);
  return { ...c, projectId: c.project.id as string, admin: supabaseAdmin() };
}

async function getAgreement(admin: ReturnType<typeof supabaseAdmin>, id: string) {
  const { data } = await admin.from('agreements').select('*').eq('project_id', id).maybeSingle();
  return data as AgreementRow | null;
}

/** The contractor starts a blank agreement. */
export async function startAgreement(formData: FormData) {
  const { role, projectId, admin, user } = await context(formData);
  if (role !== 'contractor') fail(projectId, 'Only the contractor can start the agreement.');
  if (!(await getAgreement(admin, projectId))) {
    await admin.from('agreements').insert({ project_id: projectId, updated_by: user.id });
    await admin.from('agreement_milestones').insert(
      [
        ['Deposit at signing', 20],
        ['Midpoint, materials on site', 40],
        ['Substantial completion', 30],
        ['Final walkthrough and lien waiver', 10],
      ].map(([label, pct], position) => ({ project_id: projectId, position, label, pct })),
    );
  }
  redirect(page(projectId, '?edit=1'));
}

/** Replaces the whole draft. Any earlier signatures are cleared, because they no longer match the text. */
export async function saveAgreement(formData: FormData) {
  const { role, projectId, admin, user } = await context(formData);
  if (role !== 'contractor') fail(projectId, 'Only the contractor can edit the agreement.');
  const existing = await getAgreement(admin, projectId);
  if (!existing) fail(projectId, 'Start the agreement first.');
  if (existing.executed_at) fail(projectId, 'This agreement is signed and locked. Use a change order for changes.');

  const titles = formData.getAll('item_title').map(String);
  const kinds = formData.getAll('item_kind').map(String);
  const prices = formData.getAll('item_price').map(String);
  const descs = formData.getAll('item_desc').map(String);
  const items = titles
    .map((t, i) => ({
      title: t.trim().slice(0, 200),
      kind: kinds[i] === 'allowance' ? 'allowance' : 'work',
      price_cents: Math.max(0, parseDollars(prices[i] ?? '')),
      description: (descs[i] ?? '').trim().slice(0, 1000),
    }))
    .filter((i) => i.title || i.price_cents > 0 || i.description);
  if (items.some((i) => !i.title)) fail(projectId, 'Every scope item needs a name.');

  const labels = formData.getAll('ms_label').map(String);
  const pcts = formData.getAll('ms_pct').map(String);
  const milestones = labels
    .map((l, i) => ({ label: l.trim().slice(0, 200), pct: Math.min(100, Math.max(0, parseFloat(pcts[i] ?? '') || 0)) }))
    .filter((m) => m.label || m.pct > 0);
  if (milestones.some((m) => !m.label)) fail(projectId, 'Every payment milestone needs a name.');

  const date = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };
  const text = (k: string, max: number) => String(formData.get(k) ?? '').trim().slice(0, max);

  await admin.from('agreement_signatures').delete().eq('project_id', projectId);
  await admin.from('agreement_items').delete().eq('project_id', projectId);
  await admin.from('agreement_milestones').delete().eq('project_id', projectId);

  if (items.length) {
    const { error } = await admin
      .from('agreement_items')
      .insert(items.map((i, position) => ({ ...i, project_id: projectId, position })));
    if (error) fail(projectId, 'Could not save the scope items. Try again.');
  }
  if (milestones.length) {
    const { error } = await admin
      .from('agreement_milestones')
      .insert(milestones.map((m, position) => ({ ...m, project_id: projectId, position })));
    if (error) fail(projectId, 'Could not save the payment schedule. Try again.');
  }

  const permits = String(formData.get('permits_by') ?? '') === 'homeowner' ? 'homeowner' : 'contractor';
  const { error } = await admin
    .from('agreements')
    .update({
      revision: existing.revision + 1,
      exclusions: text('exclusions', 2000),
      start_date: date('start_date'),
      end_date: date('end_date'),
      working_hours: text('working_hours', 200),
      permits_by: permits,
      warranty_months: Math.min(240, Math.max(0, parseInt(String(formData.get('warranty_months') ?? '12'), 10) || 0)),
      cleanup: text('cleanup', 1000),
      disputes: text('disputes', 1000),
      sent_at: null,
      disclosure_ack_at: null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', projectId);
  if (error) fail(projectId, 'Could not save the agreement. Try again.');

  revalidatePath(page(projectId));
  redirect(page(projectId));
}

async function loadParts(admin: ReturnType<typeof supabaseAdmin>, projectId: string) {
  const [{ data: items }, { data: ms }] = await Promise.all([
    admin.from('agreement_items').select('*').eq('project_id', projectId).order('position'),
    admin.from('agreement_milestones').select('*').eq('project_id', projectId).order('position'),
  ]);
  return { items: (items ?? []) as Item[], ms: (ms ?? []) as Milestone[] };
}

/** The contractor sends the finished draft to the homeowner. */
export async function sendAgreement(formData: FormData) {
  const { role, projectId, admin, user } = await context(formData);
  if (role !== 'contractor') fail(projectId, 'Only the contractor can send the agreement.');
  const a = await getAgreement(admin, projectId);
  if (!a) fail(projectId, 'Start the agreement first.');
  if (a.executed_at) fail(projectId, 'This agreement is already signed.');

  const { items, ms } = await loadParts(admin, projectId);
  const issues = agreementIssues(a, items, ms);
  if (issues.length) fail(projectId, issues[0]);

  await admin.from('agreements').update({ sent_at: new Date().toISOString() }).eq('project_id', projectId);
  await notifyOtherSide({
    projectId,
    senderId: user.id,
    senderRole: 'contractor',
    kind: 'agreement',
    title: (n) => `Agreement ready to review on ${n}`,
    body: 'Your contractor sent the agreement. Review the scope, price and schedule, then sign when you are ready.',
  });
  revalidatePath(page(projectId));
  redirect(page(projectId));
}

/** A typed-name signature. The second signature locks the agreement. */
export async function signAgreement(formData: FormData) {
  const { role, projectId, admin, user } = await context(formData);
  const a = await getAgreement(admin, projectId);
  if (!a || !a.sent_at) fail(projectId, 'The agreement has not been sent yet.');
  if (a.executed_at) fail(projectId, 'This agreement is already signed by both sides.');

  const { items, ms } = await loadParts(admin, projectId);
  if (agreementIssues(a, items, ms).length) fail(projectId, 'The agreement is incomplete.');

  const name = String(formData.get('typed_name') ?? '').trim().slice(0, 200);
  if (name.length < 3) fail(projectId, 'Type your full name to sign.');
  if (formData.get('agree') !== 'on') fail(projectId, 'Tick the box to confirm you agree.');
  if (role === 'homeowner' && formData.get('disclosure') !== 'on')
    fail(projectId, 'Confirm that your contractor gave you the Texas disclosure statement before you sign.');

  const { error } = await admin
    .from('agreement_signatures')
    .insert({ project_id: projectId, role, user_id: user.id, typed_name: name, revision: a.revision });
  if (error) fail(projectId, 'You have already signed this version.');

  if (role === 'homeowner') {
    await admin.from('agreements').update({ disclosure_ack_at: new Date().toISOString() }).eq('project_id', projectId);
  }

  const { data: sigs } = await admin.from('agreement_signatures').select('role').eq('project_id', projectId);
  const both = (sigs ?? []).length >= 2;
  if (both) await admin.from('agreements').update({ executed_at: new Date().toISOString() }).eq('project_id', projectId);

  await notifyOtherSide({
    projectId,
    senderId: user.id,
    senderRole: role,
    kind: 'agreement',
    title: (n) => (both ? `Agreement fully signed on ${n}` : `${role === 'contractor' ? 'Your contractor' : 'Your customer'} signed the agreement on ${n}`),
    body: both ? 'Both sides have signed. The scope and price are now locked. Use change orders for anything new.' : 'Your signature is the last step.',
  });
  revalidatePath(page(projectId));
  redirect(page(projectId));
}

/** Texas homestead steps the contractor records. Jobfile does not file anything. */
export async function saveHomestead(formData: FormData) {
  const { role, projectId, admin, project } = await context(formData);
  if (role !== 'contractor') fail(projectId, 'Only the contractor can update these steps.');
  if (!project.is_homestead) fail(projectId, 'This project is not marked as a homestead.');
  const filed = String(formData.get('filed_on') ?? '').trim();
  await admin
    .from('agreements')
    .update({
      homestead_spouse_confirmed: formData.get('spouse') === 'on',
      homestead_filed_on: /^\d{4}-\d{2}-\d{2}$/.test(filed) ? filed : null,
    })
    .eq('project_id', projectId);
  revalidatePath(page(projectId));
  redirect(page(projectId));
}
