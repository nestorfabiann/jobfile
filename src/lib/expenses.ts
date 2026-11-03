import type { SupabaseClient } from '@supabase/supabase-js';
import { milestoneAmounts, totals, type ChangeOrder, type Item, type Milestone } from '@/lib/agreement';

export const CATS = ['materials', 'labor', 'equipment', 'permits', 'other'] as const;
export type Cat = (typeof CATS)[number];
export const CAT_LABEL: Record<Cat, string> = { materials: 'Materials', labor: 'Labor and helpers', equipment: 'Equipment and fuel', permits: 'Permits and fees', other: 'Other' };
export const CAT_CHIP: Record<Cat, string> = { materials: 'Materials', labor: 'Labor', equipment: 'Equipment / fuel', permits: 'Permits', other: 'Other' };
export const isCat = (v: unknown): v is Cat => CATS.includes(v as Cat);
export const catOf = (v: unknown): Cat => (isCat(v) ? v : 'other');

export type Money = { total: number; received: number; spent: number; toCollect: number; profit: number; byCat: Record<Cat, number> };
const blank = (): Money => ({ total: 0, received: 0, spent: 0, toCollect: 0, profit: 0, byCat: { materials: 0, labor: 0, equipment: 0, permits: 0, other: 0 } });

/**
 * Money for each project: contract total (agreement plus approved change orders), received (payments the contractor
 * confirmed) and spent (expenses). Server-side only, for the contractor's own projects.
 */
export async function moneyFor(db: SupabaseClient, projectIds: string[]): Promise<Map<string, Money>> {
  const out = new Map<string, Money>();
  projectIds.forEach((id) => out.set(id, blank()));
  if (!projectIds.length) return out;
  const [{ data: items }, { data: ms }, { data: cos }, { data: ex }] = await Promise.all([
    db.from('agreement_items').select('project_id,price_cents').in('project_id', projectIds),
    db.from('agreement_milestones').select('id,project_id,position,label,pct,pay_status').in('project_id', projectIds).order('position'),
    db.from('change_orders').select('project_id,status,cost_cents,days').in('project_id', projectIds),
    db.from('project_expenses').select('project_id,amount_cents,category').in('project_id', projectIds),
  ]);
  for (const id of projectIds) {
    const m = out.get(id)!;
    const t = totals((items ?? []).filter((i: any) => i.project_id === id) as Item[], (cos ?? []).filter((c: any) => c.project_id === id) as ChangeOrder[]);
    const mine = (ms ?? []).filter((x: any) => x.project_id === id).map((x: any) => ({ ...x, pct: Number(x.pct) })) as (Milestone & { pay_status: string })[];
    const due = milestoneAmounts(t.base, mine);
    m.total = t.total;
    m.received = mine.reduce((s, x, i) => (x.pay_status === 'confirmed' ? s + due[i] : s), 0);
    (ex ?? []).filter((e: any) => e.project_id === id).forEach((e: any) => {
      const c: Cat = isCat(e.category) ? e.category : 'other';
      m.spent += Number(e.amount_cents);
      m.byCat[c] += Number(e.amount_cents);
    });
    m.toCollect = Math.max(0, m.total - m.received);
    m.profit = m.received - m.spent;
  }
  return out;
}
