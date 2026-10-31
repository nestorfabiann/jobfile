'use server';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export async function sendLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`/login?error=email&email=${encodeURIComponent(email)}`);

  const { error } = await supabaseServer().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) redirect(`/login?error=send&email=${encodeURIComponent(email)}`);
  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`);
}
