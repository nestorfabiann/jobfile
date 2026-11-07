'use server';

import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';

async function record(id: string, kind: 'seen' | 'tap' | 'dismiss') {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const { user } = await requireUser();
  try {
    await supabaseAdmin().from('announcement_events').upsert({ announcement_id: id, user_id: user.id, kind }, { onConflict: 'announcement_id,user_id,kind', ignoreDuplicates: true });
  } catch { /* never block the page */ }
}

export async function announceSeen(id: string) { await record(id, 'seen'); }
export async function announceTap(id: string) { await record(id, 'tap'); }
export async function announceDismiss(id: string) { await record(id, 'dismiss'); }
