import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { alertHref } from '@/lib/alertPath';
import { milestoneAmounts, totals, type ChangeOrder, type Item, type Milestone } from '@/lib/agreement';

export type NeedIcon = 'sign' | 'co' | 'pay' | 'bid' | 'msg' | 'star' | 'job' | 'done';
export type NeedItem = { key: string; icon: NeedIcon; title: string; sub: string; href: string; go: string; at: string };

/** "Today", "Waiting 1 day", "Waiting 4 days", and whether it has waited long enough to flag. */
export function ageOf(iso: string): { label: string; late: boolean } {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return { label: 'Today', late: false };
  return { label: `Waiting ${days} day${days === 1 ? '' : 's'}`, late: days >= 3 };
}

type P = { id: string; name: string; company_id: string | null; completed_at: string | null };

/**
 * Open tasks from the real state of each active project: an agreement to sign or send, a change order to answer,
 * a payment to make or confirm. A task disappears when the underlying thing is done.
 */
export async function projectTasks(userId: string, projects: P[], myCompanyIds: string[]): Promise<NeedItem[]> {
  const active = projects.filter((p) => !p.completed_at);
  if (!active.length) return [];
  const ids = active.map((p) => p.id);
  const db = supabaseAdmin();
  const [{ data: pm }, { data: ags }, { data: sigs }, { data: cos }, { data: ms }, { data: items }] = await Promise.all([
    db.from('project_members').select('project_id,role').eq('user_id', userId).in('project_id', ids),
    db.from('agreements').select('project_id,sent_at,executed_at,updated_at').in('project_id', ids),
    db.from('agreement_signatures').select('project_id,role').in('project_id', ids),
    db.from('change_orders').select('id,project_id,number,title,cost_cents,days,requested_role,status,created_at,decided_by,decided_at,description').in('project_id', ids),
    db.from('agreement_milestones').select('id,project_id,position,label,pct,pay_status,requested_at,paid_at').in('project_id', ids).order('position'),
    db.from('agreement_items').select('id,project_id,position,title,description,kind,price_cents').in('project_id', ids),
  ]);
  const roleOf = (p: P): 'contractor' | 'homeowner' => {
    if (p.company_id && myCompanyIds.includes(p.company_id)) return 'contractor';
    const m = (pm ?? []).find((x: any) => x.project_id === p.id);
    return (m as any)?.role === 'contractor' ? 'contractor' : 'homeowner';
  };

  // Homeowners asking a contractor to close out a job (kept for 14 days, until the job is complete).
  const { data: fin } = await db.from('notifications').select('project_id,created_at').eq('user_id', userId).eq('kind', 'finish_request').in('project_id', ids).gt('created_at', new Date(Date.now() - 14 * 86400000).toISOString()).order('created_at', { ascending: false });
  const out: NeedItem[] = [];
  for (const p of active) {
    const f = (fin ?? []).find((x: any) => x.project_id === p.id) as any;
    if (f) out.push({ key: `fin-${p.id}`, icon: 'done', title: 'Homeowner says the work is finished', sub: `${p.name} · Mark it complete to open ratings`, href: alertHref(p.id, 'finish_request'), go: 'Review', at: f.created_at });
    const role = roleOf(p);
    const ag: any = (ags ?? []).find((a: any) => a.project_id === p.id);
    const signed = new Set((sigs ?? []).filter((s: any) => s.project_id === p.id).map((s: any) => s.role as string));
    const here = (kind: string) => alertHref(p.id, kind);

    // Agreement: send it (contractor), then both sides sign.
    if (ag && !ag.executed_at) {
      if (!ag.sent_at) {
        if (role === 'contractor') out.push({ key: `a-send-${p.id}`, icon: 'sign', title: 'Finish and send the agreement', sub: p.name, href: here('agreement'), go: 'Open', at: ag.updated_at });
      } else if (!signed.has(role)) {
        out.push({ key: `a-sign-${p.id}`, icon: 'sign', title: 'Sign the agreement', sub: p.name, href: here('agreement'), go: 'Review', at: ag.sent_at });
      }
    }

    // Change orders waiting for an answer from the other side.
    (cos ?? []).filter((c: any) => c.project_id === p.id && c.status === 'pending' && c.requested_role !== role).forEach((c: any) => {
      out.push({ key: `co-${c.id}`, icon: 'co', title: `${role === 'homeowner' ? 'Approve' : 'Answer'} change order CO-${c.number}${c.cost_cents ? ` (${c.cost_cents > 0 ? '+' : ''}${dollars(c.cost_cents)})` : ''}`, sub: `${p.name} · ${c.title}`, href: here('change'), go: 'Review', at: c.created_at });
    });

    // Payments: the homeowner pays a requested milestone; the contractor confirms one marked paid.
    const mine = (ms ?? []).filter((m: any) => m.project_id === p.id) as (Milestone & { pay_status: string; requested_at: string | null; paid_at: string | null })[];
    if (mine.length) {
      const its = (items ?? []).filter((i: any) => i.project_id === p.id) as Item[];
      const chg = (cos ?? []).filter((c: any) => c.project_id === p.id) as ChangeOrder[];
      const amts = milestoneAmounts(totals(its, chg).base, mine);
      mine.forEach((m, i) => {
        if (role === 'homeowner' && m.pay_status === 'requested') out.push({ key: `pay-${m.id}`, icon: 'pay', title: `Pay ${m.label} (${dollars(amts[i])})`, sub: `${p.name} · requested by your contractor`, href: here('payment'), go: 'Open', at: m.requested_at ?? new Date().toISOString() });
        if (role === 'contractor' && m.pay_status === 'paid') out.push({ key: `conf-${m.id}`, icon: 'pay', title: `Confirm payment received (${dollars(amts[i])})`, sub: `${p.name} · ${m.label}`, href: here('payment'), go: 'Confirm', at: m.paid_at ?? new Date().toISOString() });
      });
    }
  }
  return out;
}
