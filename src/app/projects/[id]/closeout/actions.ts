'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';

const money = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? '').replace(/[$,\s]/g, '');
  if (!s) return null;
  const n = Math.round(parseFloat(s) * 100);
  return Number.isFinite(n) && n >= 0 && n < 100_000_000 ? n : null;
};

/** Each side confirms its own side of the closeout. Never blocks completing the job. */
export async function confirmCloseout(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const { role, user, project } = await loadProject(projectId);
  const path = `/projects/${project.id}/closeout`;
  const db = supabaseAdmin();
  const { data: itemRows } = await db.from('agreement_items').select('id').eq('project_id', project.id);
  const ids = new Set(((itemRows ?? []) as any[]).map((i) => i.id as string));
  const okVals = role === 'homeowner' ? ['done', 'not_done'] : ['done', 'changed'];
  const scope: Record<string, string> = {};
  ids.forEach((id) => { const v = String(formData.get(`s_${id}`) ?? ''); if (okVals.includes(v)) scope[id] = v; });
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  let paid: number | null = null;
  let answer: string | null = null;
  if (role === 'homeowner') {
    paid = String(formData.get('paid_choice') ?? '') === 'more' ? money(formData.get('paid_total')) : null;
  } else {
    const a = String(formData.get('payment_answer') ?? '');
    answer = a === 'received' || a === 'not_received' ? a : null;
  }
  const row: Record<string, unknown> = { project_id: project.id, role, user_id: user.id, scope, note, updated_at: new Date().toISOString(), confirmed_at: new Date().toISOString() };
  if (role === 'homeowner') row.homeowner_paid_cents = paid;
  else row.payment_answer = answer;
  const { error } = await db.from('closeout_confirms').upsert(row, { onConflict: 'project_id,role' });
  if (error) redirect(`${path}?error=${encodeURIComponent('Could not save. Check that the database step was run.')}`);
  const flagged = Object.values(scope).some((v) => v === 'not_done' || v === 'changed') || (role === 'homeowner' && paid != null);
  await notifyOtherSide({
    projectId: project.id,
    senderId: user.id,
    senderRole: role,
    kind: 'closeout',
    title: (n) => `${role === 'homeowner' ? 'The homeowner' : 'The contractor'} confirmed their side of the closeout on ${n}`,
    body: flagged ? 'Something needs a look. Open the closeout checklist.' : 'Open the closeout checklist to confirm your side.',
    throttle: true,
  });
  revalidatePath(path);
  redirect(`${path}?ok=1`);
}
