'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, roleFor } from '@/lib/session';
import { notifyOtherSide } from '@/lib/notify';

const TAGS = ['update', 'question', 'decision'] as const;
type Tag = (typeof TAGS)[number];

export async function sendMessage(formData: FormData) {
  const { sb, user } = await requireUser();
  const projectId = String(formData.get('project_id') ?? '');
  const body = String(formData.get('body') ?? '').trim().slice(0, 4000);
  const rawTag = String(formData.get('tag') ?? '');
  const tag: Tag | null = (TAGS as readonly string[]).includes(rawTag) ? (rawTag as Tag) : null;
  if (!projectId || !body) return;

  const role = await roleFor(sb, projectId, user.id);
  if (!role) redirect('/projects');

  const { error } = await sb
    .from('messages')
    .insert({ project_id: projectId, sender_id: user.id, sender_role: role, tag, body });
  if (error) redirect(`/projects/${projectId}?error=${encodeURIComponent('Could not send that message. Try again.')}`);

  const verb = tag === 'question' ? 'asked a question' : tag === 'decision' ? 'logged a decision' : 'sent a message';
  const who = role === 'contractor' ? 'Your contractor' : 'Your customer';
  await notifyOtherSide({
    projectId,
    senderId: user.id,
    senderRole: role,
    kind: 'message',
    title: (projectName) => `${who} ${verb} on ${projectName}`,
    body: body.length > 240 ? `${body.slice(0, 240)}…` : body,
    // Casual messages are grouped so a quick back-and-forth does not send ten emails.
    throttle: tag !== 'question' && tag !== 'decision',
  });

  revalidatePath(`/projects/${projectId}`);
}
