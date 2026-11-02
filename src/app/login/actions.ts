'use server';

import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';
import { NEXT_COOKIE, safeNext } from '@/lib/nextPath';

export async function sendLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`/login?error=email&email=${encodeURIComponent(email)}`);

  // Remember where to send them after they open the email link (for example back to the job they wanted to bid on).
  const next = safeNext(formData.get('next'));
  if (next) cookies().set(NEXT_COOKIE, next, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 3600, path: '/' });
  const nq = next ? `&next=${encodeURIComponent(next)}` : '';

  const host = headers().get('x-forwarded-host') || headers().get('host');
  const origin = host ? `https://${host}` : process.env.APP_URL || '';
  const { error } = await supabaseServer().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) redirect(`/login?error=send&email=${encodeURIComponent(email)}${nq}`);
  redirect(`/login?sent=1&email=${encodeURIComponent(email)}${nq}`);
}
