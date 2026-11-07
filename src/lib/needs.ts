import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { alertHref } from '@/lib/alertPath';
import { visitTodo, type Visit } from '@/lib/visits';
import { addDays, todayChi } from '@/lib/schedule';
import { milestoneAmounts, totals, type ChangeOrder, type Item, type Milestone } from '@/lib/agreement';

export type NeedIcon = 'sign' | 'co' | 'pay' | 'bid' | 'msg' | 'star' | 'job' | 'done' | 'visit' | 'choice' | 'cal';
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
  const soon = addDays(todayChi(), 7);
  const [{ data: pm }, { data: ags }, { data: sigs }, { data: cos }, { data: ms }, { data: items }, { data: vis }, { data: sels }, { data: moved }] = await Promise.all([
    db.from('project_members').select('project_id,role').eq('user_id', userId).in('project_id', ids),
    db.from('agreements').select('project_id,sent_at,executed_at,updated_at').in('project_id', ids),
    db.from('agreement_signatures').select('project_id,role').in('project_id', ids),
    db.from('change_orders').select('*').in('project_id', ids),
    db.from('agreement_milestones').select('*').in('project_id', ids).order('position'),
    db.from('agreement_items').select('id,project_id,position,title,description,kind,price_cents').in('project_id', ids),
    db.from('visits').select('*').in('project_id', ids).in('status', ['requested', 'proposed', 'done']),
    db.from('selections').select('id,project_id,title,needed_by,created_at').in('project_id', ids).eq('status', 'open'),
    db.from('schedule_changes').select('project_id,created_at').in('project_id', ids).is('homeowner_seen_at', null),
  ]);
  const roleOf = (p: P): 'contractor' | 'homeowner' => {
    if (p.company_id && myCompanyIds.includes(p.company_id)) return 'contractor';
    const m = (pm ?? []).find((x: any) => x.project_id === p.id);
    return (m as any)?.role === 'contractor' ? 'contractor' : 'homeowner';
  };

  // Homeowners asking a contractor to close out a job (kept for 14 days, until the job is complete).
  const { data: fin } = await db.from('notifications').select('project_id,created_at,kind').eq('user_id', userId).in('kind', ['finish_request', 'finish_cancel']).in('project_id', ids).gt('created_at', new Date(Date.now() - 14 * 86400000).toISOString()).order('created_at', { ascending: false });
  // Scope lines the contractor marked done that the homeowner has not answered yet (Looks good or Question).
  const { data: scopeDone } = await db.from('project_scope_status').select('project_id,done_at').in('project_id', ids).eq('status', 'done').is('ho_reaction', null);
  const out: NeedItem[] = [];
  for (const p of active) {
    const f = (fin ?? []).find((x: any) => x.project_id === p.id) as any;
    if (f && f.kind === 'finish_request') out.push({ key: `fin-${p.id}`, icon: 'done', title: 'Homeowner says the work is finished', sub: `${p.name} · Mark it complete to open ratings`, href: alertHref(p.id, 'finish_request'), go: 'Review', at: f.created_at });
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
    // Approved change orders that add cost are billed on their own lines.
    (cos ?? []).filter((c: any) => c.project_id === p.id && c.status === 'approved' && Number(c.cost_cents) > 0).forEach((c: any) => {
      const amt = dollars(Number(c.cost_cents));
      if (role === 'homeowner' && c.pay_status === 'requested') out.push({ key: `pay-co-${c.id}`, icon: 'pay', title: `Pay CO-${c.number} (${amt})`, sub: `${p.name} · requested by your contractor`, href: here('payment'), go: 'Open', at: c.requested_at ?? new Date().toISOString() });
      if (role === 'contractor' && c.pay_status === 'paid') out.push({ key: `conf-co-${c.id}`, icon: 'pay', title: `Confirm payment received (${amt})`, sub: `${p.name} · CO-${c.number}`, href: here('payment'), go: 'Confirm', at: c.paid_at ?? new Date().toISOString() });
    });
    // Site visits waiting on this person: times to propose, or a time to pick.
    ((vis ?? []) as unknown as (Visit & { updated_at?: string })[]).filter((v) => v.project_id === p.id).forEach((v) => {
      const todo = visitTodo(v, role);
      if (!todo) return;
      out.push({ key: `visit-${v.id}`, icon: 'visit', title: todo === 'confirm' ? `Did your contractor visit? (${v.title.toLowerCase()})` : todo === 'pick' ? `Pick a time for ${v.title.toLowerCase()}` : `Propose times for ${v.title.toLowerCase()}`, sub: todo === 'confirm' ? `${p.name} · Tell us if they came` : todo === 'pick' ? `${p.name} · ${v.slots.length} time${v.slots.length === 1 ? '' : 's'} suggested` : p.name, href: here('visit'), go: todo === 'confirm' ? 'Confirm' : todo === 'pick' ? 'Pick' : 'Propose', at: v.updated_at ?? v.created_at });
    });

    // Homeowner: choices due within a week, and date changes not yet seen.
    if (role === 'homeowner') {
      ((sels ?? []) as any[]).filter((x) => x.project_id === p.id && x.needed_by && x.needed_by <= soon).forEach((x) => {
        out.push({ key: `sel-${x.id}`, icon: 'choice', title: `Choose: ${x.title}`, sub: `${p.name} · needed by ${new Date(`${x.needed_by}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, href: here('selection'), go: 'Choose', at: x.created_at });
      });
      const fin2 = ((scopeDone ?? []) as any[]).filter((x) => x.project_id === p.id).sort((a, b) => String(a.done_at).localeCompare(String(b.done_at)));
      if (fin2.length) out.push({ key: `scope-${p.id}`, icon: 'done', title: `Review finished work (${fin2.length} ${fin2.length === 1 ? 'item' : 'items'})`, sub: `${p.name} · Tap Looks good, or ask a question`, href: `/projects/${p.id}/overview#scope`, go: 'Review', at: fin2[0].done_at ?? new Date().toISOString() });
      const mv = ((moved ?? []) as any[]).filter((x) => x.project_id === p.id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
      if (mv) out.push({ key: `moved-${p.id}`, icon: 'cal', title: 'A date changed on your schedule', sub: `${p.name} · see what moved and why`, href: here('schedule'), go: 'See', at: mv.created_at });
    }

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
