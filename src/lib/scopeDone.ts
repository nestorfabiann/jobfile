import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Projects where every scope line (agreement work lines plus approved change orders) is marked done.
 * A project with no scope lines is never included. Returns an empty set if the scope table is missing.
 */
export async function projectsAllScopeDone(projectIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!projectIds.length) return out;
  try {
    const db = supabaseAdmin();
    const [{ data: work }, { data: cos }, { data: st }] = await Promise.all([
      db.from('agreement_items').select('id,project_id').in('project_id', projectIds).eq('kind', 'work'),
      db.from('change_orders').select('id,project_id').in('project_id', projectIds).eq('status', 'approved'),
      db.from('project_scope_status').select('project_id,ref_kind,ref_id,status').in('project_id', projectIds),
    ]);
    const done = new Set(((st ?? []) as any[]).filter((r) => r.status === 'done').map((r) => `${r.project_id}:${r.ref_kind}:${r.ref_id}`));
    const need = new Map<string, string[]>();
    ((work ?? []) as any[]).forEach((w) => need.set(w.project_id, [...(need.get(w.project_id) ?? []), `${w.project_id}:item:${w.id}`]));
    ((cos ?? []) as any[]).forEach((c) => need.set(c.project_id, [...(need.get(c.project_id) ?? []), `${c.project_id}:co:${c.id}`]));
    need.forEach((keys, pid) => { if (keys.length && keys.every((k) => done.has(k))) out.add(pid); });
  } catch { /* scope table not created yet */ }
  return out;
}
