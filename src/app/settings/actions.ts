'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { asLang, translateEnabled } from '@/lib/translate';

/** Turns a US phone number into +1XXXXXXXXXX, or returns null if it is not one. */
function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export async function saveSettings(formData: FormData) {
  const { sb, user } = await requireUser();
  const fullName = String(formData.get('full_name') ?? '').trim().slice(0, 120);
  const phoneRaw = String(formData.get('phone') ?? '').trim();
  const notifyEmail = formData.get('notify_email') === 'on';
  const notifySms = formData.get('notify_sms') === 'on';
  const consent = formData.get('sms_consent') === 'on';

  let phone = '';
  if (phoneRaw) {
    const p = toE164(phoneRaw);
    if (!p) redirect('/settings?error=Enter+a+10-digit+US+phone+number.');
    phone = p;
  }
  if (notifySms && !phone) redirect('/settings?error=Add+a+phone+number+to+turn+on+text+alerts.');
  if (notifySms && !consent) redirect('/settings?error=Tick+the+box+to+agree+to+receive+text+alerts.');

  const { data: current } = await sb.from('profiles').select('sms_consent_at').eq('id', user.id).single();

  const lang = translateEnabled() ? { language: asLang(formData.get('language')), auto_translate: formData.get('auto_translate') === 'on' } : {};

  const { error } = await sb
    .from('profiles')
    .update({
      ...lang,
      full_name: fullName,
      phone,
      notify_email: notifyEmail,
      notify_sms: notifySms,
      sms_consent_at: notifySms ? current?.sms_consent_at ?? new Date().toISOString() : null,
    })
    .eq('id', user.id);
  if (error) redirect('/settings?error=Could+not+save+your+settings.');

  // ZIP and the tips switch live in the 020 columns. Saved separately so settings still work until that step is run.
  const zipRaw = String(formData.get('zip') ?? '').replace(/\D/g, '');
  if (formData.has('zip') && zipRaw && !/^\d{5}$/.test(zipRaw)) redirect('/settings?error=Enter+a+5+digit+ZIP+code.');
  const extra: Record<string, unknown> = {};
  if (formData.has('zip')) extra.zip = zipRaw || null;
  if (formData.has('marketing_email') || formData.has('zip')) extra.marketing_email = formData.get('marketing_email') === 'on';
  if (Object.keys(extra).length) await sb.from('profiles').update(extra).eq('id', user.id);

  revalidatePath('/settings');
  redirect('/settings?saved=1');
}
