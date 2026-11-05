import { supabaseAdmin } from '@/lib/supabase/server';

export const MAX_FINISH_REQUESTS_PER_DAY = 3;

/** True while the homeowner's "the work is finished" request is standing: sent in the last day and not taken back since. */
export async function finishAsked(projectId: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data } = await supabaseAdmin().from('notifications').select('kind,created_at').eq('project_id', projectId).in('kind', ['finish_request', 'finish_cancel']).gt('created_at', since).order('created_at', { ascending: false }).limit(1);
    return (data ?? [])[0]?.kind === 'finish_request';
  } catch { return false; }
}

export async function finishRequestsToday(projectId: string): Promise<number> {
  try {
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data } = await supabaseAdmin().from('notifications').select('id,user_id').eq('project_id', projectId).eq('kind', 'finish_request').gt('created_at', since);
    // One request makes one alert per contractor, so count the distinct moments instead of the rows.
    const users = new Set(((data ?? []) as any[]).map((r) => r.user_id as string));
    return users.size ? Math.ceil((data ?? []).length / users.size) : 0;
  } catch { return 0; }
}
