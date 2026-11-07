import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyUsers } from '@/lib/notify';

/** Scope lines per project: the agreement work lines plus approved change orders, and how many are marked done. */
export async function scopeCounts(projectIds: string[]): Promise<Map<string, { total: number; done: number }>> {
  const out = new Map<string, { total: number; done: number }>();
  if (!projectIds.length) return out;
  try {
    const db = supabaseAdmin();
    const [{ data: work }, { data: cos }, { data: st }] = await Promise.all([
      db.from('agreement_items').select('id,project_id').in('project_id', projectIds).eq('kind', 'work'),
      db.from('change_orders').select('id,project_id').in('project_id', projectIds).eq('status', 'approved'),
      db.from('project_scope_status').select('project_id,ref_kind,ref_id,status').in('project_id', projectIds),
    ]);
    const done = new Set(((st ?? []) as any[]).filter((r) => r.status === 'done').map((r) => `${r.project_id}:${r.ref_kind}:${r.ref_id}`));
    const add = (pid: string, key: string) => {
      const c = out.get(pid) ?? { total: 0, done: 0 };
      c.total++;
      if (done.has(key)) c.done++;
      out.set(pid, c);
    };
    ((work ?? []) as any[]).forEach((w) => add(w.project_id, `${w.project_id}:item:${w.id}`));
    ((cos ?? []) as any[]).forEach((c) => add(c.project_id, `${c.project_id}:co:${c.id}`));
  } catch { /* scope table not created yet */ }
  return out;
}

/** Projects where every scope line is marked done. A project with no scope lines is never included. */
export async function projectsAllScopeDone(projectIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  (await scopeCounts(projectIds)).forEach((c, pid) => { if (c.total > 0 && c.done === c.total) out.add(pid); });
  return out;
}

/**
 * Projects that are ready to complete: signed agreement, not complete, every scope line done (or no scope lines but a
 * payment schedule), every payment confirmed received, and no open punch-list items.
 */
export async function projectsReady(projectIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!projectIds.length) return out;
  try {
    const db = supabaseAdmin();
    const [counts, { data: ags }, { data: ms }, { data: cos }, { data: fixes }, { data: projs }] = await Promise.all([
      scopeCounts(projectIds),
      db.from('agreements').select('project_id,executed_at').in('project_id', projectIds),
      db.from('agreement_milestones').select('project_id,pay_status').in('project_id', projectIds),
      db.from('change_orders').select('project_id,pay_status,cost_cents').in('project_id', projectIds).eq('status', 'approved'),
      db.from('photos').select('project_id,status').in('project_id', projectIds).eq('kind', 'fix'),
      db.from('projects').select('id,completed_at').in('id', projectIds),
    ]);
    const executed = new Set(((ags ?? []) as any[]).filter((a) => a.executed_at).map((a) => a.project_id as string));
    const completed = new Set(((projs ?? []) as any[]).filter((p) => p.completed_at).map((p) => p.id as string));
    for (const pid of projectIds) {
      if (!executed.has(pid) || completed.has(pid)) continue;
      const c = counts.get(pid);
      const mine = ((ms ?? []) as any[]).filter((m) => m.project_id === pid);
      const bills = ((cos ?? []) as any[]).filter((x) => x.project_id === pid && Number(x.cost_cents) > 0);
      if (!(c && c.total > 0) && mine.length === 0) continue;
      if (c && c.done < c.total) continue;
      if (!mine.every((m) => m.pay_status === 'confirmed') || !bills.every((x) => x.pay_status === 'confirmed')) continue;
      if (((fixes ?? []) as any[]).some((f) => f.project_id === pid && (f.status === 'open' || f.status === 'fixed'))) continue;
      out.add(pid);
    }
  } catch { /* tables missing */ }
  return out;
}

/**
 * Send the "everything is done and paid" alert to both sides, once per project, when it is ready to complete.
 * Returns true when the project is ready (whether or not it just sent), so callers can skip a weaker alert.
 */
export async function nudgeIfReady(projectId: string, senderId: string, senderRole: 'contractor' | 'homeowner'): Promise<boolean> {
  try {
    if (!(await projectsReady([projectId])).has(projectId)) return false;
    const db = supabaseAdmin();
    const { count } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('kind', 'ready_complete');
    if ((count ?? 0) > 0) return true;
    const { data: project } = await db.from('projects').select('id,name,company_id').eq('id', projectId).single();
    if (!project) return true;
    const { data: members } = await db.from('project_members').select('user_id,role').eq('project_id', projectId);
    const { data: staff } = await db.from('company_members').select('user_id').eq('company_id', project.company_id);
    const homeowners = Array.from(new Set((members ?? []).filter((m: any) => m.role === 'homeowner').map((m: any) => m.user_id as string)));
    const contractors = Array.from(new Set([...(members ?? []).filter((m: any) => m.role === 'contractor').map((m: any) => m.user_id as string), ...(staff ?? []).map((s: any) => s.user_id as string)]));
    const name = project.name as string;
    await notifyUsers({ userIds: contractors, projectId, kind: 'ready_complete', title: `Everything is done and paid on ${name}. Mark it complete so you can both rate.`, body: 'Completing the project lets your homeowner rate your work. Ratings show on your public profile once you both rate, or after 14 days.' });
    await notifyUsers({ userIds: homeowners, projectId, kind: 'ready_complete', title: `Everything is done and paid on ${name}. Tell your contractor the work is finished, then rate each other.`, body: 'Look over the finished work. When you are happy with it, tell your contractor it is finished. Then you can both rate each other.' });
    void senderId; void senderRole;
    return true;
  } catch { return false; }
}
