'use server';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export async function signOut() {
  await supabaseServer().auth.signOut();
  redirect('/login');
}
