'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';

/** Saves the homeowner's ZIP from the card on Projects. */
export async function saveZip(formData: FormData) {
  const { user } = await requireUser();
  const back = formData.get('back') === '/find' ? '/find' : '/projects';
  const zip = String(formData.get('zip') ?? '').replace(/\D/g, '');
  if (!/^\d{5}$/.test(zip)) redirect(`${back}?zip_error=Enter+a+5+digit+ZIP+code.`);
  const { error } = await supabaseAdmin().from('profiles').update({ zip }).eq('id', user.id);
  if (error) redirect(`${back}?zip_error=Could+not+save+your+ZIP.+Try+again+later.`);
  revalidatePath('/projects');
  revalidatePath('/find');
  redirect(back);
}

/** "Skip for now" lasts until the browser session ends, so the card comes back at the next sign-in. */
export async function skipZip() {
  await requireUser();
  cookies().set('jf_zip_skip', '1', { path: '/', sameSite: 'lax', httpOnly: true });
  revalidatePath('/projects');
  redirect('/projects');
}
