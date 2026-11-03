import { supabaseAdmin } from '@/lib/supabase/server';
import { alertHref } from '@/lib/alertPath';

export type Summary = { contractor: string; stage: string; pct: number; payDone: number; payTotal: number; next: string; action: boolean; href: string };
type P = { id: string; company_id: string | null; closeout_started_at: string | null; completed_at: string | null };

const rows = async (q: PromiseLike<{ data: any }>): Promise<any[]> => ((await q).data as any[]) ?? [];

/** Where each project stands, in plain words, for the homeowner's Projects page. */
export async function homeownerSummaries(projects: P[]): Promise<Map<string, Summary>> {
  const out = new Map<string, Summary>();
  if (!projects.length) return out;
  const db = supabaseAdmin();
  const ids = projects.map((p) => p.id);
  const cids = Array.from(new Set(projects.map((p) => p.company_id).filter(Boolean) as string[]));
  const [cs, ags, sigs, cos, ms] = await Promise.all([
    cids.length ? rows(db.from('companies').select('id,name').in('id', cids)) : Promise.resolve([] as any[]),
    rows(db.from('agreements').select('project_id,sent_at,executed_at').in('project_id', ids)),
    rows(db.from('agreement_signatures').select('project_id,role').in('project_id', ids)),
    rows(db.from('change_orders').select('project_id,number,status,requested_role').in('project_id', ids)),
    rows(db.from('agreement_milestones').select('project_id,position,label,pay_status').in('project_id', ids).order('position')),
  ]);
  const names = new Map<string, string>(cs.map((c: any) => [c.id as string, c.name as string] as [string, string]));
  for (const p of projects) {
    const ag = ags.find((a: any) => a.project_id === p.id);
    const sent = !!ag?.sent_at;
    const executed = !!ag?.executed_at;
    const signedMe = sigs.some((s: any) => s.project_id === p.id && s.role === 'homeowner');
    const mine = ms.filter((m: any) => m.project_id === p.id);
    const payTotal = mine.length;
    const payDone = mine.filter((m: any) => m.pay_status === 'paid' || m.pay_status === 'confirmed').length;
    const n = p.completed_at ? 3 : p.closeout_started_at ? 2 : executed ? 1 : 0;
    const stage = ['Agreement', 'Work in progress', 'Closeout', 'Completed'][n];
    const floor = [8, 15, 90, 100][n];
    const pct = Math.min(100, Math.max(floor, payTotal ? Math.round((payDone / payTotal) * 100) : 0));
    let next = '';
    let kind = 'stage';
    let action = false;
    if (n === 0) {
      if (!ag || !sent) next = 'Waiting for your contractor to send the agreement';
      else if (!signedMe) { next = 'Sign the agreement'; kind = 'agreement'; action = true; }
      else next = 'Waiting for your contractor to sign';
      if (kind === 'stage') kind = 'agreement';
    } else if (n < 3) {
      const co = cos.find((c: any) => c.project_id === p.id && c.status === 'pending' && c.requested_role !== 'homeowner');
      const req = mine.find((m: any) => m.pay_status === 'requested');
      if (co) { next = `Approve change order CO-${co.number}`; kind = 'change'; action = true; }
      else if (req) { next = `Pay: ${req.label}`; kind = 'payment'; action = true; }
      else next = n === 2 ? 'Closeout: check the final work' : 'Work is underway';
    }
    out.set(p.id, { contractor: names.get(p.company_id ?? '') ?? '', stage, pct, payDone, payTotal, next, action, href: alertHref(p.id, kind) });
  }
  return out;
}
