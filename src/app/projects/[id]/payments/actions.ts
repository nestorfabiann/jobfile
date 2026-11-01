'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';
import { dollars } from '@/lib/money';
import { milestoneAmounts, type Milestone } from '@/lib/agreement';

const page = (id: string, q = '') => `/projects/${id}/payments${q}`;
function fail(id: string, msg: string): never {
  redirect(page(id, `?error=${encodeURIComponent(msg)}`));
}
const METHODS = ['check', 'cash', 'ach', 'card', 'other'];

/** Loads a milestone, its agreed amount, and checks the agreement is signed by both sides. */
async function load(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const ctx = await loadProject(projectId);
  const admin = supabaseAdmin();

  const { data: agr } = await admin.from('agreements').select('executed_at').eq('project_id', ctx.project.id).maybeSingle();
  if (!agr?.executed_at) fail(ctx.project.id, 'Payments open after both sides sign the agreement.');

  const [{ data: ms }, { data: items }] = await Promise.all([
    admin.from('agreement_milestones').select('*').eq('project_id', ctx.project.id).order('position'),
    admin.from('agreement_items').select('price_cents').eq('project_id', ctx.project.id),
  ]);
  const list = ((ms ?? []) as (Milestone & { pay_status: string })[]).map((m) => ({ ...m, pct: Number(m.pct) }));
  const idx = list.findIndex((m) => m.id === id);
  if (idx === -1) fail(ctx.project.id, 'That milestone was not found.');
  const base = (items ?? []).reduce((s, i) => s + Number(i.price_cents), 0);
  const amount = milestoneAmounts(base, list)[idx];
  return { ...ctx, admin, m: list[idx], amount };
}

function done(projectId: string): never {
  revalidatePath(page(projectId));
  revalidatePath(`/projects/${projectId}/overview`);
  redirect(page(projectId));
}

/** Contractor asks for the next payment. */
export async function requestPayment(formData: FormData) {
  const { role, user, project, admin, m, amount } = await load(formData);
  if (role !== 'contractor') fail(project.id, 'Only the contractor can request a payment.');
  if (m.pay_status !== 'scheduled') fail(project.id, 'That payment was already requested.');

  await admin.from('agreement_milestones').update({ pay_status: 'requested', requested_at: new Date().toISOString() }).eq('id', m.id);
  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'payment',
    title: (n) => `Payment requested on ${n}: ${dollars(amount)}`,
    body: `${m.label}: ${dollars(amount)}. Open Payments to mark it paid when you have paid it.`,
  });
  done(project.id);
}

/** Contractor takes a request back. */
export async function cancelRequest(formData: FormData) {
  const { role, project, admin, m } = await load(formData);
  if (role !== 'contractor') fail(project.id, 'Only the contractor can cancel a request.');
  if (m.pay_status !== 'requested') fail(project.id, 'Nothing to cancel.');
  await admin.from('agreement_milestones').update({ pay_status: 'scheduled', requested_at: null }).eq('id', m.id);
  done(project.id);
}

/** Homeowner says they paid, and how. */
export async function markPaid(formData: FormData) {
  const { role, user, project, admin, m, amount } = await load(formData);
  if (role !== 'homeowner') fail(project.id, 'Only the homeowner marks a payment as paid.');
  if (m.pay_status !== 'requested') fail(project.id, 'The contractor has not requested this payment.');
  const method = METHODS.includes(String(formData.get('method'))) ? String(formData.get('method')) : 'other';

  await admin
    .from('agreement_milestones')
    .update({ pay_status: 'paid', paid_at: new Date().toISOString(), paid_method: method })
    .eq('id', m.id);
  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'payment',
    title: (n) => `Payment sent on ${n}: ${dollars(amount)}`,
    body: `${m.label}: marked paid by ${method}. Open Payments to confirm you received it.`,
  });
  done(project.id);
}

/** Contractor confirms the money arrived, and whether a lien waiver was handed over. */
export async function confirmReceived(formData: FormData) {
  const { role, user, project, admin, m, amount } = await load(formData);
  if (role !== 'contractor') fail(project.id, 'Only the contractor confirms receipt.');
  if (m.pay_status !== 'paid') fail(project.id, 'This payment has not been marked paid.');
  const lien = formData.get('lien_waiver') === 'on';

  await admin
    .from('agreement_milestones')
    .update({ pay_status: 'confirmed', confirmed_at: new Date().toISOString(), lien_waiver: lien })
    .eq('id', m.id);
  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'payment',
    title: (n) => `Payment received on ${n}: ${dollars(amount)}`,
    body: `${m.label} was confirmed received.${lien ? ' A lien waiver was provided.' : ''}`,
  });
  done(project.id);
}

/** Homeowner flags that a "paid" mark was a mistake, or contractor says money did not arrive. */
export async function reopenPayment(formData: FormData) {
  const { project, admin, m } = await load(formData);
  if (m.pay_status !== 'paid') fail(project.id, 'Only a payment waiting for confirmation can be sent back.');
  await admin.from('agreement_milestones').update({ pay_status: 'requested', paid_at: null, paid_method: null }).eq('id', m.id);
  done(project.id);
}
