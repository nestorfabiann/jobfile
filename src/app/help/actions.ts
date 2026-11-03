'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { HELP_PER_DAY, isTopic } from '@/lib/help';

export async function sendHelp(formData: FormData) {
  const { sb, user } = await requireUser();
  const topic = String(formData.get('topic') ?? 'question');
  const body = String(formData.get('body') ?? '').trim().slice(0, 2000);
  const pid = String(formData.get('project_id') ?? '');
  if (!isTopic(topic)) redirect('/help?error=Pick+what+this+is+about.');
  if (body.length < 3) redirect('/help?error=Tell+us+a+little+more+so+we+can+help.');

  const db = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await db.from('help_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gt('created_at', since);
  if ((count ?? 0) >= HELP_PER_DAY) redirect('/help?error=You+have+sent+a+lot+of+messages+today.+We+will+reply+soon.');

  // Only attach a project the person can really see.
  let project_id: string | null = null;
  if (/^[0-9a-f-]{36}$/.test(pid)) {
    const { data: p } = await sb.from('projects').select('id').eq('id', pid).maybeSingle();
    if (p) project_id = p.id as string;
  }
  const h = headers();
  let page = '';
  try { page = new URL(h.get('referer') ?? '').pathname.slice(0, 200); } catch { /* no referer */ }
  const ua = (h.get('user-agent') ?? '').slice(0, 200);
  const device = /iPhone|iPad/.test(ua) ? 'iPhone or iPad' : /Android/.test(ua) ? 'Android' : /Mac|Windows|Linux/.test(ua) ? 'Computer' : '';

  const { error } = await db.from('help_messages').insert({ user_id: user.id, topic, project_id, body, page, device });
  if (error) redirect('/help?error=We+could+not+send+that.+Try+again+in+a+minute.');
  redirect('/help?sent=1');
}
