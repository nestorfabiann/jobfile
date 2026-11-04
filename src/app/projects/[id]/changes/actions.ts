'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';
import { dollars, parseDollars, signedDollars } from '@/lib/money';
import { creditRoom, spreadCredit, sumItems, type Item, type Milestone } from '@/lib/agreement';

/** The signed price and the payment schedule, for checking and applying credits. */
async function schedule(admin: ReturnType<typeof supabaseAdmin>, projectId: string) {
  const [{ data: items }, { data: ms }] = await Promise.all([
    admin.from('agreement_items').select('price_cents').eq('project_id', projectId),
    admin.from('agreement_milestones').select('*').eq('project_id', projectId).order('position'),
  ]);
  return { base: sumItems((items ?? []) as Item[]), ms: ((ms ?? []) as any[]).map((m) => ({ ...m, pct: Number(m.pct) })) as Milestone[] };
}

const page = (id: string, q = '') => `/projects/${id}/changes${q}`;
function fail(id: string, msg: string): never {
  redirect(page(id, `?error=${encodeURIComponent(msg)}`));
}

/** Either side can propose a change once the agreement is signed by both. */
export async function createChangeOrder(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const { role, user, project } = await loadProject(projectId);
  const admin = supabaseAdmin();

  const { data: agr } = await admin.from('agreements').select('executed_at').eq('project_id', project.id).maybeSingle();
  if (!agr?.executed_at) fail(project.id, 'Change orders open after both sides sign the agreement.');

  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  if (!title) fail(project.id, 'Give the change order a title.');
  const description = String(formData.get('description') ?? '').trim().slice(0, 2000);
  const cost = parseDollars(String(formData.get('cost') ?? ''));
  const days = Math.max(-365, Math.min(365, parseInt(String(formData.get('days') ?? '0'), 10) || 0));

  if (cost < 0) {
    const { base, ms } = await schedule(admin, project.id);
    const room = creditRoom(base, ms);
    if (-cost > room) fail(project.id, `This credit is too big. Only ${dollars(room)} is left on payments that have not been requested yet. Lower the credit, or agree on a refund outside Jobfile.`);
  }

  const { data: last } = await admin
    .from('change_orders')
    .select('number')
    .eq('project_id', project.id)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const number = ((last?.number as number | undefined) ?? 0) + 1;

  const { error } = await admin.from('change_orders').insert({
    project_id: project.id,
    number,
    title,
    description,
    cost_cents: cost,
    days,
    requested_by: user.id,
    requested_role: role,
  });
  if (error) fail(project.id, 'Could not save the change order. Try again.');

  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'change',
    title: (n) => `Change order CO-${number} needs your approval on ${n}`,
    body: `${title} (${signedDollars(cost)}). Open the project to approve or decline it.`,
  });

  revalidatePath(page(project.id));
  redirect(page(project.id));
}

/** The other side approves or declines. The person who asked can withdraw. */
export async function decideChange(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const { role, user, project } = await loadProject(projectId);
  const admin = supabaseAdmin();

  const { data: co } = await admin.from('change_orders').select('*').eq('id', id).eq('project_id', project.id).maybeSingle();
  if (!co) fail(project.id, 'That change order was not found.');
  if (co.status !== 'pending') fail(project.id, 'That change order has already been decided.');

  let status: 'approved' | 'declined' | 'withdrawn';
  if (decision === 'withdraw') {
    if (co.requested_role !== role) fail(project.id, 'Only the person who proposed it can withdraw it.');
    status = 'withdrawn';
  } else if (decision === 'approve' || decision === 'decline') {
    if (co.requested_role === role) fail(project.id, 'The other side has to approve or decline your change order.');
    status = decision === 'approve' ? 'approved' : 'declined';
  } else {
    fail(project.id, 'Unknown action.');
  }

  const finalStatus = status;
  if (finalStatus === 'approved' && (co.cost_cents as number) < 0) {
    const { base, ms } = await schedule(admin, project.id);
    if (-(co.cost_cents as number) > creditRoom(base, ms)) fail(project.id, 'This credit is now bigger than what is left on unrequested payments. Ask for a smaller credit.');
  }
  const { error } = await admin
    .from('change_orders')
    .update({ status: finalStatus, decided_by: user.id, decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) fail(project.id, 'Could not update the change order. Try again.');

  // An approved credit lowers the last unrequested payments.
  if (finalStatus === 'approved' && (co.cost_cents as number) < 0) {
    const { base, ms } = await schedule(admin, project.id);
    for (const u of spreadCredit(base, ms, -(co.cost_cents as number), `CO-${co.number} credit`)) {
      await admin.from('agreement_milestones').update({ adjust_cents: u.adjust_cents, adjust_note: u.adjust_note }).eq('id', u.id);
    }
  }

  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'change',
    title: (n) => `CO-${co.number} was ${finalStatus} on ${n}`,
    body: `${co.title} (${signedDollars(co.cost_cents as number)}) was ${finalStatus}.${
      finalStatus === 'approved'
        ? ` ${role === 'homeowner' ? ((co.cost_cents as number) > 0 ? 'You can start the work. Request payment from the Payments tab when it is done.' : 'You can start the work.') : ''}`
        : finalStatus === 'declined'
          ? ` ${role === 'homeowner' ? 'You can message your customer, or send a revised change order.' : 'You can message your contractor, or send a revised change order.'}`
          : ''
    }`.trim(),
  });

  revalidatePath(page(project.id));
  redirect(page(project.id));
}
