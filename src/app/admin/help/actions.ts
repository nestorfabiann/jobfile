'use server';

import { revalidatePath } from 'next/cache';
import { audit, requireAdmin } from '@/lib/admin';
import { notifyUsers } from '@/lib/notify';

/** Reply to a help message: saves the reply, marks it done and alerts the person. */
export async function replyHelp(formData: FormData) {
  const { user: me, db } = await requireAdmin('help');
  const id = String(formData.get('id') ?? '');
  const reply = String(formData.get('reply') ?? '').trim().slice(0, 2000);
  if (!/^[0-9a-f-]{36}$/.test(id) || reply.length < 1) return;
  const { data: m } = await db.from('help_messages').select('id,user_id').eq('id', id).maybeSingle();
  if (!m) return;
  const now = new Date().toISOString();
  await db.from('help_messages').update({ reply, replied_at: now, done_at: now }).eq('id', id);
  await audit(me, 'help_reply', { type: 'help_message', id });
  await notifyUsers({ userIds: [m.user_id as string], projectId: null, kind: 'help', title: 'We replied to your message', body: reply.slice(0, 300), path: '/help', cta: 'Read our reply' });
  revalidatePath('/admin/help');
  revalidatePath('/admin');
}

export async function markHelpDone(formData: FormData) {
  const { user: me, db } = await requireAdmin('help');
  const id = String(formData.get('id') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await db.from('help_messages').update({ done_at: new Date().toISOString() }).eq('id', id);
  await audit(me, 'help_done', { type: 'help_message', id });
  revalidatePath('/admin/help');
  revalidatePath('/admin');
}
