'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { myOwnedCompany } from '@/lib/companyProfile';

const safeBack = (v: unknown) => (v === '/projects' ? '/projects' : '/settings/business');

export async function setAvailability(formData: FormData) {
  const back = safeBack(formData.get('back'));
  const c = await myOwnedCompany();
  if (!c) redirect(`${back}?error=Only+a+company+owner+can+change+availability.`);
  const mode = String(formData.get('mode') ?? '');
  if (mode !== 'open' && mode !== 'booked' && mode !== 'paused') redirect(`${back}?error=Pick+an+availability+option.`);
  let until: string | null = null;
  if (mode === 'booked') {
    const raw = String(formData.get('until') ?? '');
    const todayCt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const max = new Date(Date.now() + 550 * 86400_000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw <= todayCt || raw > max) redirect(`${back}?error=Choose+a+date+in+the+future+for+Booked+until.`);
    until = raw;
  }
  const { error } = await supabaseAdmin().from('companies').update({ availability: mode, booked_until: until }).eq('id', c!.companyId);
  if (error) redirect(`${back}?error=Could+not+save.+Check+that+the+database+step+was+run.`);
  revalidatePath('/projects');
  revalidatePath('/settings/business');
  revalidatePath('/find');
  redirect(back === '/projects' ? '/projects' : '/settings/business?saved=1');
}
