import { dollars, signedDollars, daysText } from './money';

export type AgreementRow = {
  project_id: string;
  revision: number;
  exclusions: string;
  start_date: string | null;
  end_date: string | null;
  working_hours: string;
  permits_by: 'contractor' | 'homeowner';
  warranty_months: number;
  cleanup: string;
  disputes: string;
  sent_at: string | null;
  disclosure_ack_at: string | null;
  homestead_spouse_confirmed: boolean;
  homestead_filed_on: string | null;
  executed_at: string | null;
};
export type Item = { id: string; position: number; title: string; description: string; kind: 'work' | 'allowance'; price_cents: number };
export type Milestone = { id: string; position: number; label: string; pct: number };
export type Signature = { role: 'contractor' | 'homeowner'; typed_name: string; revision: number; signed_at: string };
export type ChangeOrder = {
  id: string;
  number: number;
  title: string;
  description: string;
  cost_cents: number;
  days: number;
  requested_role: 'contractor' | 'homeowner';
  status: 'pending' | 'approved' | 'declined' | 'withdrawn';
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export const STANDARD_TERMS = [
  'Changes to price, materials or schedule happen only through a written change order that both parties approve before the extra work starts.',
  'The homeowner pays each milestone when the contractor requests it and the milestone is complete. The final payment is due after the final walkthrough and delivery of a final lien waiver.',
  'The contractor holds the license and insurance listed in this agreement, will provide a certificate of insurance, and is responsible for subcontractors and their payment.',
  'The homeowner provides access to the work area, working utilities and timely material selections. Late selections can move the schedule.',
  'Hidden conditions (rot, mold, old wiring, asbestos, code violations found after opening walls) and material backorders can change price and time. They are handled by change order.',
  'Where the law requires it (for example, sales made in the home), the homeowner may cancel within 3 business days of signing. Check your state’s rules.',
  'Workmanship is warranted for the period stated in this agreement. Manufacturer warranties pass to the homeowner.',
];

export const sumItems = (items: Item[]) => items.reduce((s, i) => s + i.price_cents, 0);

export function totals(items: Item[], changes: ChangeOrder[]) {
  const base = sumItems(items);
  const approved = changes.filter((c) => c.status === 'approved');
  const chg = approved.reduce((s, c) => s + c.cost_cents, 0);
  const days = approved.reduce((s, c) => s + c.days, 0);
  return { base, chg, days, total: base + chg };
}

/** What blocks sending or signing. An empty list means the agreement is complete. */
export function agreementIssues(a: AgreementRow, items: Item[], ms: Milestone[]): string[] {
  const out: string[] = [];
  if (!items.length || !items.some((i) => i.price_cents > 0)) out.push('Add at least one scope item with a price.');
  if (!a.start_date || !a.end_date) out.push('Set a start date and an estimated completion date.');
  else if (a.end_date < a.start_date) out.push('The completion date is before the start date.');
  const sum = ms.reduce((s, m) => s + Number(m.pct), 0);
  if (!ms.length || Math.abs(sum - 100) > 0.001) out.push(`The payment schedule adds up to ${Math.round(sum * 100) / 100}%. It must be 100%.`);
  return out;
}

/** Cents due at each milestone. The last one absorbs rounding so the amounts add up exactly. */
export function milestoneAmounts(baseCents: number, ms: Milestone[]): number[] {
  let remaining = baseCents;
  return ms.map((m, i) => {
    const amt = i === ms.length - 1 ? remaining : Math.round((baseCents * Number(m.pct)) / 100);
    remaining -= amt;
    return amt;
  });
}

export function agreementText(opts: {
  projectName: string;
  address: string;
  homeowner: string;
  contractor: string;
  agreement: AgreementRow;
  items: Item[];
  milestones: Milestone[];
  signatures: Signature[];
  changes: ChangeOrder[];
}): string {
  const { agreement: a, items, milestones, signatures, changes } = opts;
  const t = totals(items, changes);
  const L: string[] = [];
  const ln = (s = '') => L.push(s);
  ln('HOME IMPROVEMENT AGREEMENT');
  ln(opts.projectName);
  ln(opts.address);
  ln(`Revision ${a.revision}`);
  ln();
  ln('PARTIES');
  ln(`Homeowner: ${opts.homeowner}`);
  ln(`Contractor: ${opts.contractor}`);
  ln();
  ln('SCOPE OF WORK AND PRICE');
  items.forEach((i) => {
    ln(`- ${i.title}${i.kind === 'allowance' ? ' (allowance)' : ''}: ${dollars(i.price_cents)}`);
    if (i.description) ln(`    ${i.description}`);
  });
  ln(`Agreed price: ${dollars(t.base)}`);
  const ap = changes.filter((c) => c.status === 'approved');
  if (ap.length) {
    ln();
    ln('APPROVED CHANGE ORDERS');
    ap.forEach((c) => ln(`- CO-${c.number} ${c.title}: ${signedDollars(c.cost_cents)}, ${daysText(c.days)}`));
    ln(`Current contract total: ${dollars(t.total)}`);
  }
  ln();
  ln('NOT INCLUDED');
  ln(a.exclusions || 'Nothing listed.');
  ln();
  ln('TIMELINE AND TERMS');
  ln(`Start: ${a.start_date ?? ''}`);
  ln(`Estimated completion: ${a.end_date ?? ''}`);
  ln(`Working hours: ${a.working_hours}`);
  ln(`Permits pulled by: ${a.permits_by === 'homeowner' ? 'Homeowner' : 'Contractor'}`);
  ln(`Workmanship warranty: ${a.warranty_months} months`);
  ln(`Cleanup: ${a.cleanup}`);
  ln(`Disputes: ${a.disputes}`);
  ln();
  ln('PAYMENT SCHEDULE');
  const amts = milestoneAmounts(t.base, milestones);
  milestones.forEach((m, i) => ln(`- ${m.label}: ${Number(m.pct)}% = ${dollars(amts[i])}`));
  ln();
  ln('STANDARD TERMS');
  STANDARD_TERMS.forEach((s, i) => ln(`${i + 1}. ${s}`));
  ln();
  ln('SIGNATURES');
  (['homeowner', 'contractor'] as const).forEach((r) => {
    const s = signatures.find((x) => x.role === r);
    ln(`${r === 'homeowner' ? 'Homeowner' : 'Contractor'}: ${s ? `${s.typed_name}, ${new Date(s.signed_at).toUTCString()}` : 'not signed'}`);
  });
  return L.join('\n');
}
