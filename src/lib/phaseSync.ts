import type { supabaseAdmin } from '@/lib/supabase/server';

/** Work items and approved paid change orders with no phase of the same name. One-item agreements are skipped, since their phases come from the trade list. */
export async function missingFromAgreement(admin: ReturnType<typeof supabaseAdmin>, projectId: string): Promise<{ title: string; note: string }[]> {
  const [{ data: ph }, { data: it }, { data: co }] = await Promise.all([
    admin.from('project_phases').select('title').eq('project_id', projectId),
    admin.from('agreement_items').select('title').eq('project_id', projectId).eq('kind', 'work').order('position'),
    admin.from('change_orders').select('title,cost_cents').eq('project_id', projectId).eq('status', 'approved').order('number'),
  ]);
  const have = new Set(((ph ?? []) as any[]).map((p) => String(p.title).trim().toLowerCase()));
  const items = ((it ?? []) as any[]).map((i) => String(i.title).trim());
  const out: { title: string; note: string }[] = [];
  if (items.length >= 2) items.forEach((t) => { if (t && !have.has(t.toLowerCase())) out.push({ title: t.slice(0, 120), note: 'From the agreement' }); });
  ((co ?? []) as any[]).filter((c) => Number(c.cost_cents) > 0).forEach((c) => { const t = String(c.title).trim(); if (t && !have.has(t.toLowerCase())) out.push({ title: t.slice(0, 120), note: 'From a change order' }); });
  return out.slice(0, 10);
}
