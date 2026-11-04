'use server';

import { revalidatePath } from 'next/cache';
import { audit, requireAdmin } from '@/lib/admin';
import { notifyUsers } from '@/lib/notify';

/** Approve or reject a Google page a contractor linked that did not match automatically. */
export async function reviewLinkedRating(formData: FormData) {
  const { user: me, db } = await requireAdmin('verification');
  const id = String(formData.get('company_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  if (!id || (decision !== 'approved' && decision !== 'rejected')) return;
  const { data: row } = await db.from('company_ratings').select('place_name').eq('company_id', id).eq('source', 'google').maybeSingle();
  if (!row) return;
  if (decision === 'approved') {
    await db.from('company_ratings').update({ status: 'approved' }).eq('company_id', id).eq('source', 'google');
  } else {
    await db.from('company_ratings').delete().eq('company_id', id).eq('source', 'google');
    const { data: owners } = await db.from('company_members').select('user_id').eq('company_id', id).eq('role', 'owner');
    await notifyUsers({
      userIds: (owners ?? []).map((o) => o.user_id as string),
      projectId: null,
      kind: 'admin',
      path: '/settings/business#bp-ratings',
      title: 'Your Google link was not accepted',
      body: `We could not match ${row.place_name as string} to your business. Open Business profile and link the right page.`,
      force: true,
    });
  }
  await audit(me, decision === 'approved' ? 'rating_link_approve' : 'rating_link_reject', { type: 'company', id }, { place: row.place_name });
  revalidatePath('/admin/linked-ratings');
  revalidatePath(`/contractors/${id}`);
}
