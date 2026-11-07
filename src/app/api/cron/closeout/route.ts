import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyUsers } from '@/lib/notify';
import { projectsAllScopeDone } from '@/lib/scopeDone';
import { finishAsked } from '@/lib/finishRequest';

export const dynamic = 'force-dynamic';

const DAY = 86400_000;

/** Daily job. One gentle reminder to the homeowner when everything on the list has been done for 3 days and the job is not closed. Each project gets it once. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = supabaseAdmin();
  let sent = 0;
  try {
    const { data: projects } = await db.from('projects').select('id,name,completed_at').is('completed_at', null).limit(1000);
    const ids = ((projects ?? []) as any[]).map((p) => p.id as string);
    const ready = await projectsAllScopeDone(ids);
    for (const p of (projects ?? []) as any[]) {
      if (!ready.has(p.id)) continue;
      // Latest "done" time on this project's list.
      const { data: last } = await db.from('project_scope_status').select('done_at').eq('project_id', p.id).eq('status', 'done').order('done_at', { ascending: false }).limit(1);
      const doneAt = (last ?? [])[0]?.done_at as string | undefined;
      if (!doneAt || Date.now() - new Date(doneAt).getTime() < 3 * DAY) continue;
      if (await finishAsked(p.id)) continue;
      const { count } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('project_id', p.id).eq('kind', 'closeout_remind');
      if ((count ?? 0) > 0) continue;
      const { data: mem } = await db.from('project_members').select('user_id').eq('project_id', p.id).eq('role', 'homeowner');
      const userIds = ((mem ?? []) as any[]).map((m) => m.user_id as string);
      if (!userIds.length) continue;
      await notifyUsers({ userIds, projectId: p.id, kind: 'closeout_remind', path: `/projects/${p.id}/overview#closeout`, title: `${p.name} finished the list`, body: 'Take a look when you are ready. When you are happy with the work, tell your contractor it is finished.', cta: 'Open the project' });
      sent++;
    }
  } catch { /* tables missing: nothing to send */ }
  return NextResponse.json({ ok: true, sent });
}
