'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';
import { dollars, parseDollars } from '@/lib/money';
import { totals, type ChangeOrder, type Item } from '@/lib/agreement';

const page = (id: string, q = '') => `/projects/${id}/payments${q}`;
function fail(id: string, msg: string): never {
  redirect(page(id, `?error=${encodeURIComponent(msg)}`));
}
const METHODS = ['check', 'cash', 'ach', 'card', 'other'];

/** Either side records a payment. The other side confirms it. Jobfile does not move money. */
export async function recordPayment(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const { role, user, project } = await loadProject(projectId);
  const admin = supabaseAdmin();

  const { data: agr } = await admin.from('agreements').select('executed_at').eq('project_id', project.id).maybeSingle();
  if (!agr?.executed_at) fail(project.id, 'Payments open after both sides sign the agreement.');

  const amount = parseDollars(String(formData.get('amount') ?? ''));
  if (amount <= 0) fail(project.id, 'Enter an amount greater than zero.');

  const method = METHODS.includes(String(formData.get('method'))) ? String(formData.get('method')) : 'other';
  const paidOn = String(formData.get('paid_on') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) fail(project.id, 'Choose the date of the payment.');
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);

  let milestoneId: string | null = String(formData.get('milestone_id') ?? '') || null;
  if (milestoneId) {
    const { data: m } = await admin.from('agreement_milestones').select('id').eq('id', milestoneId).eq('project_id', project.id).maybeSingle();
    if (!m) milestoneId = null;
  }

  // Do not let the total recorded go past the contract total.
  const [{ data: items }, { data: cos }, { data: pays }] = await Promise.all([
    admin.from('agreement_items').select('price_cents').eq('project_id', project.id),
    admin.from('change_orders').select('cost_cents,days,status').eq('project_id', project.id),
    admin.from('payments').select('amount_cents,status').eq('project_id', project.id),
  ]);
  const t = totals((items ?? []) as Item[], (cos ?? []) as ChangeOrder[]);
  const already = (pays ?? []).filter((p) => p.status !== 'disputed').reduce((s, p) => s + Number(p.amount_cents), 0);
  if (already + amount > t.total) {
    fail(project.id, `That would be more than the contract total. Remaining balance: ${dollars(Math.max(0, t.total - already))}.`);
  }

  const { error } = await admin.from('payments').insert({
    project_id: project.id,
    milestone_id: milestoneId,
    amount_cents: amount,
    method,
    paid_on: paidOn,
    note,
    recorded_by: user.id,
    recorded_role: role,
  });
  if (error) fail(project.id, 'Could not save the payment. Try again.');

  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'payment',
    title: (n) => `${role === 'homeowner' ? 'A payment was made' : 'A payment was received'} on ${n}: please confirm`,
    body: `${dollars(amount)} by ${method} on ${paidOn}.${note ? ' ' + note : ''} Open Payments to confirm or dispute it.`,
  });

  revalidatePath(page(project.id));
  revalidatePath(`/projects/${project.id}/overview`);
  redirect(page(project.id));
}

/** The other side confirms or disputes. The person who recorded it can remove it until it is confirmed. */
export async function decidePayment(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const { role, user, project } = await loadProject(projectId);
  const admin = supabaseAdmin();

  const { data: p } = await admin.from('payments').select('*').eq('id', id).eq('project_id', project.id).maybeSingle();
  if (!p) fail(project.id, 'That payment was not found.');

  if (decision === 'withdraw') {
    if (p.recorded_role !== role) fail(project.id, 'Only the person who recorded it can remove it.');
    if (p.status === 'confirmed') fail(project.id, 'A confirmed payment cannot be removed.');
    await admin.from('payments').delete().eq('id', p.id);
  } else if (decision === 'confirm' || decision === 'dispute') {
    if (p.recorded_role === role) fail(project.id, 'The other side has to confirm your payment.');
    if (p.status !== 'recorded') fail(project.id, 'That payment was already decided.');
    const status = decision === 'confirm' ? 'confirmed' : 'disputed';
    await admin
      .from('payments')
      .update({ status, confirmed_by: user.id, confirmed_at: new Date().toISOString() })
      .eq('id', p.id)
      .eq('status', 'recorded');
    await notifyOtherSide({
      projectId: project.id,
      senderId: user.id,
      senderRole: role,
      kind: 'payment',
      title: (n) => `A payment was ${status} on ${n}`,
      body:
        status === 'confirmed'
          ? `${dollars(Number(p.amount_cents))} was confirmed.`
          : `${dollars(Number(p.amount_cents))} was disputed. Talk it through in Messages.`,
    });
  } else {
    fail(project.id, 'Unknown action.');
  }

  revalidatePath(page(project.id));
  revalidatePath(`/projects/${project.id}/overview`);
  redirect(page(project.id));
}
