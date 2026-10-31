'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';

export async function sendLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`/login?error=email&email=${encodeURIComponent(email)}`);

  const host = headers().get('x-forwarded-host') || headers().get('host');
  const origin = host ? `https://${host}` : process.env.APP_URL || '';
  const { error } = await supabaseServer().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) redirect(`/login?error=send&email=${encodeURIComponent(email)}`);
  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`);
}
