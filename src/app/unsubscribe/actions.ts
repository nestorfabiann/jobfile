'use server';

import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { unsubValid } from '@/lib/unsub';

/** Turns off tips and local news for the person named in a signed email link. */
export async function unsubscribe(formData: FormData) {
  const u = String(formData.get('u') ?? '');
  const t = String(formData.get('t') ?? '');
  if (!unsubValid(u, t)) redirect('/unsubscribe?bad=1');
  await supabaseAdmin().from('profiles').update({ marketing_email: false }).eq('id', u);
  redirect(`/unsubscribe?done=1`);
}
