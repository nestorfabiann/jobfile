'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { INVITE_SKIP_COOKIE } from '@/lib/invites';

/** "Not now" on the invite card: hides it for 30 days. */
export async function dismissInvite(formData: FormData) {
  await requireUser();
  cookies().set(INVITE_SKIP_COOKIE, '1', { path: '/', sameSite: 'lax', httpOnly: true, maxAge: 30 * 24 * 3600 });
  const back = String(formData.get('back') ?? '');
  redirect(back.startsWith('/') && !back.startsWith('//') && !back.includes('\\') ? back.slice(0, 200) : '/projects');
}
