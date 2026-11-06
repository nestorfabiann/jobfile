import { milestoneAmounts } from './agreement';

/** Platform-wide money recorded in the app. Read only; Jobfile does not hold or move money. */
export type MoneyRange = '7' | '30' | 'year' | 'all';
export const RANGES: [MoneyRange, string][] = [['7', '7 days'], ['30', '30 days'], ['year', 'This year'], ['all', 'All']];

export type ProjectMoney = {
  id: string; name: string; trade: string; city: string;
  executedAt: string; agreed: number; paid: number; requested: number; changes: number;
  oldestRequestAt: string | null; lastPaidAt: string | null;
};
export type MoneyData = {
  projects: ProjectMoney[];
  paidEvents: { at: string; cents: number }[];
  awardedCents: number; awardedCount: number;
  statusSplit: { scheduled: number; requested: number; paid: number };
};

const since = (r: MoneyRange) => {
  if (r === 'all') return 0;
  if (r === 'year') return new Date(new Date().getFullYear(), 0, 1).getTime();
  return Date.now() - Number(r) * 86400000;
};

export async function loadMoney(db: any, range: MoneyRange): Promise<MoneyData> {
  const cut = since(range);
  const [ag, it, ms, co, pr, li, bids] = await Promise.all([
    db.from('agreements').select('project_id,executed_at').not('executed_at', 'is', null),
    db.from('agreement_items').select('project_id,price_cents'),
    db.from('agreement_milestones').select('project_id,position,label,pct,adjust_cents,pay_status,requested_at,paid_at').order('position'),
    db.from('change_orders').select('project_id,cost_cents,status,pay_status,requested_at,paid_at').eq('status', 'approved'),
    db.from('projects').select('id,name'),
    db.from('marketplace_listings').select('project_id,job_type,city').not('project_id', 'is', null),
    db.from('marketplace_bids').select('price_cents,updated_at').eq('status', 'won'),
  ]);
  const base = new Map<string, number>();
  for (const r of (it.data ?? []) as any[]) base.set(r.project_id, (base.get(r.project_id) ?? 0) + Number(r.price_cents));
  const msBy = new Map<string, any[]>();
  for (const r of (ms.data ?? []) as any[]) msBy.set(r.project_id, [...(msBy.get(r.project_id) ?? []), r]);
  const coBy = new Map<string, any[]>();
  for (const r of (co.data ?? []) as any[]) coBy.set(r.project_id, [...(coBy.get(r.project_id) ?? []), r]);
  const name = new Map(((pr.data ?? []) as any[]).map((p) => [p.id as string, p.name as string]));
  const lst = new Map(((li.data ?? []) as any[]).map((l) => [l.project_id as string, l]));

  const projects: ProjectMoney[] = [];
  const paidEvents: { at: string; cents: number }[] = [];
  const split = { scheduled: 0, requested: 0, paid: 0 };
  const isPaid = (s: string) => s === 'paid' || s === 'confirmed';
  for (const a of (ag.data ?? []) as any[]) {
    const executed = new Date(a.executed_at).getTime();
    if (executed < cut) continue;
    const b = base.get(a.project_id) ?? 0;
    const rows = msBy.get(a.project_id) ?? [];
    const amts = milestoneAmounts(b, rows as any);
    const lines = [
      ...rows.map((m, i) => ({ cents: amts[i], s: m.pay_status ?? 'scheduled', req: m.requested_at as string | null, paidAt: m.paid_at as string | null })),
      ...(coBy.get(a.project_id) ?? []).map((c) => ({ cents: Number(c.cost_cents), s: c.pay_status ?? 'scheduled', req: c.requested_at as string | null, paidAt: c.paid_at as string | null })),
    ];
    const changes = (coBy.get(a.project_id) ?? []).reduce((s, c) => s + Number(c.cost_cents), 0);
    let paid = 0, requested = 0, oldest: string | null = null, lastPaid: string | null = null;
    for (const l of lines) {
      if (isPaid(l.s)) { paid += l.cents; split.paid += l.cents; if (l.paidAt) { paidEvents.push({ at: l.paidAt, cents: l.cents }); if (!lastPaid || l.paidAt > lastPaid) lastPaid = l.paidAt; } }
      else if (l.s === 'requested') { requested += l.cents; split.requested += l.cents; if (l.req && (!oldest || l.req < oldest)) oldest = l.req; }
      else split.scheduled += l.cents;
    }
    const l = lst.get(a.project_id);
    projects.push({
      id: a.project_id, name: name.get(a.project_id) ?? 'Project', trade: l?.job_type || 'Direct (not from the marketplace)', city: l?.city || 'Unknown',
      executedAt: a.executed_at, agreed: b + changes, paid, requested, changes, oldestRequestAt: oldest, lastPaidAt: lastPaid,
    });
  }
  const won = ((bids.data ?? []) as any[]).filter((x) => new Date(x.updated_at).getTime() >= cut);
  return { projects, paidEvents: paidEvents.filter((e) => new Date(e.at).getTime() >= cut), awardedCents: won.reduce((s, x) => s + Number(x.price_cents), 0), awardedCount: won.length, statusSplit: split };
}

export const monthKey = (iso: string) => iso.slice(0, 7);
export function groupSum(rows: ProjectMoney[], key: (p: ProjectMoney) => string) {
  const m = new Map<string, { agreed: number; paid: number; n: number }>();
  for (const p of rows) { const k = key(p); const c = m.get(k) ?? { agreed: 0, paid: 0, n: 0 }; c.agreed += p.agreed; c.paid += p.paid; c.n++; m.set(k, c); }
  return [...m.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.agreed - a.agreed);
}
// deploy retrigger
