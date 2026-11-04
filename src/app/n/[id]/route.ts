import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { alertHref } from '@/lib/alertPath';

export const dynamic = 'force-dynamic';

/** Opens an alert: marks it read, then goes to the right page. "jobs" opens the job board and clears new-job alerts. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  let path = '/projects';
  if (params.id === 'jobs') {
    await db.from('notifications').update({ read_at: now }).eq('user_id', user.id).eq('kind', 'job_match').is('read_at', null);
    path = '/marketplace';
  } else if (/^[0-9a-f-]{36}$/.test(params.id)) {
    const { data: n } = await db.from('notifications').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle();
    if (n) {
      await db.from('notifications').update({ read_at: now }).eq('id', params.id).eq('user_id', user.id);
      const to = new URL(req.url).searchParams.get('to') ?? '';
      const saved = String((n as { path?: string | null }).path ?? '');
      const ok = (x: string) => x.startsWith('/') && !x.startsWith('//');
      path = ok(saved) ? saved : ok(to) ? to : alertHref(n.project_id as string | null, n.kind as string);
    }
  }
  return NextResponse.redirect(new URL(path, req.url), 303);
}
