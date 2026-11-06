'use server';

import { revalidatePath } from 'next/cache';
import { audit, requireAdmin } from '@/lib/admin';
import { notifyUsers } from '@/lib/notify';
import type { Post } from '@/lib/community';

/** Approve or reject a showcase after both sides agreed. Approving makes it live for everyone. */
export async function reviewShowcase(formData: FormData) {
  const { user: me, db } = await requireAdmin('reviews');
  const id = String(formData.get('post_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 300);
  const { data: p } = await db.from('community_posts').select('*').eq('id', id).maybeSingle<Post>();
  if (!p || p.status !== 'pending_review') return;
  const now = new Date().toISOString();
  if (decision === 'approve') {
    await db.from('community_posts').update({ status: 'live', reviewed_at: now, reviewed_by: me.id, updated_at: now }).eq('id', id);
    await notifyUsers({ userIds: [p.author_id], projectId: null, kind: 'community', path: `/community/${id}`, title: p.kind === 'tip' ? 'Your tip is live in Community' : 'Your project is live in Community', body: p.kind === 'tip' ? 'Jobfile approved it. People can read it and mark it Helpful now.' : 'Jobfile approved it. People can see it, like it and share it now.', cta: p.kind === 'tip' ? 'See your tip' : 'See your post' });
  } else if (decision === 'reject') {
    const why = reason || 'It did not meet the Community guidelines.';
    await db.from('community_posts').update({ status: 'rejected', reject_reason: why, reviewed_at: now, reviewed_by: me.id, updated_at: now }).eq('id', id);
    await notifyUsers({ userIds: [p.author_id], projectId: null, kind: 'community', path: '/community/mine', title: p.kind === 'tip' ? 'Your tip was not approved' : 'Your post was not approved', body: `Reason: ${why}`, cta: 'Open Community' });
  } else return;
  await audit(me, decision === 'approve' ? 'community_approve' : 'community_reject', { type: 'community_post', id }, { reason });
  revalidatePath('/admin/community');
  revalidatePath('/community');
}

/** A post or comment hidden after reports: put it back, or take it down for good. */
export async function resolveHeld(formData: FormData) {
  const { user: me, db } = await requireAdmin('reviews');
  const type = String(formData.get('target_type') ?? '') === 'comment' ? 'comment' : 'post';
  const id = String(formData.get('target_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  if (decision !== 'restore' && decision !== 'remove') return;
  const now = new Date().toISOString();
  if (type === 'post') {
    await db.from('community_posts').update({ status: decision === 'restore' ? 'live' : 'removed', updated_at: now }).eq('id', id).eq('status', 'held');
  } else if (decision === 'restore') {
    await db.from('community_comments').update({ status: 'live' }).eq('id', id);
  } else {
    await db.from('community_comments').delete().eq('id', id);
  }
  // Reports on restored content are cleared so the same reports do not hide it again.
  if (decision === 'restore') await db.from('community_reports').delete().eq('target_type', type).eq('target_id', id);
  await audit(me, `community_${decision}`, { type: `community_${type}`, id });
  revalidatePath('/admin/community');
  revalidatePath('/community');
}
