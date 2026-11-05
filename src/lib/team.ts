import { supabaseAdmin } from '@/lib/supabase/server';
import { DEFAULT_RADIUS, miles, zipCoords } from '@/lib/matching';
import { notifyUsers } from '@/lib/notify';

export type TeamBid = {
  id: string; listing_id: string; lead_company_id: string; lead_user_id: string; lead_cents: number; weeks: number | null; start_date: string | null;
  inclusions: string; note: string; status: 'pending' | 'sent' | 'canceled'; bid_id: string | null; created_at: string; updated_at: string;
  structure?: 'lead' | 'separate'; hire_mode?: 'either' | 'package'; schedule_note?: string;
};
export type TeamPartner = {
  id: string; team_bid_id: string; company_id: string; scope: string; price_cents: number; counter_cents: number | null;
  status: 'invited' | 'countered' | 'confirmed' | 'declined'; created_at: string; updated_at: string;
  bid_id?: string | null; answered_by?: string | null;
};
export const PARTNER_LABEL: Record<TeamPartner['status'], string> = { invited: 'Invited', countered: 'Proposed a new price', confirmed: 'Confirmed', declined: 'Declined' };

/** The company a signed-in person belongs to, or null. */
export async function companyOf(userId: string): Promise<{ id: string; name: string } | null> {
  const db = supabaseAdmin();
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', userId).limit(1);
  const id = (mem ?? [])[0]?.company_id as string | undefined;
  if (!id) return null;
  const { data: co } = await db.from('companies').select('name').eq('id', id).maybeSingle();
  return { id, name: (co?.name as string | undefined) ?? 'A contractor' };
}

/** Everyone in a company, so an invite reaches the whole team. */
export async function memberIds(companyId: string): Promise<string[]> {
  const { data } = await supabaseAdmin().from('company_members').select('user_id').eq('company_id', companyId);
  return (data ?? []).map((m: any) => m.user_id as string);
}

/** Things waiting on a company: invites to answer, plus new prices a partner proposed on its own team bids. Zero when the team tables do not exist yet. */
export async function inviteCount(userId: string): Promise<number> {
  try {
    const co = await companyOf(userId);
    if (!co) return 0;
    const db = supabaseAdmin();
    const { data: ps } = await db.from('team_partners').select('team_bid_id').eq('company_id', co.id).eq('status', 'invited');
    const ids = (ps ?? []).map((p: any) => p.team_bid_id as string);
    const { count: invites } = ids.length ? await db.from('team_bids').select('id', { count: 'exact', head: true }).in('id', ids).eq('status', 'pending') : { count: 0 };
    const { data: mine } = await db.from('team_bids').select('id').eq('lead_company_id', co.id).eq('status', 'pending');
    const mineIds = (mine ?? []).map((t: any) => t.id as string);
    const { count: prices } = mineIds.length ? await db.from('team_partners').select('id', { count: 'exact', head: true }).in('team_bid_id', mineIds).eq('status', 'countered') : { count: 0 };
    return (invites ?? 0) + (prices ?? 0);
  } catch { return 0; }
}

/** One-contract team bids: the partner company hears what happened to the lead's bid (not selected, project closed). Never throws. */
export async function tellTeamPartners(leadBidIds: string[], title: string, body: string) {
  try {
    if (!leadBidIds.length) return;
    const db = supabaseAdmin();
    const { data: tbs } = await db.from('team_bids').select('id,structure').in('bid_id', leadBidIds);
    const ids = ((tbs ?? []) as any[]).filter((t) => t.structure !== 'separate').map((t) => t.id as string);
    if (!ids.length) return;
    const { data: ps } = await db.from('team_partners').select('company_id').in('team_bid_id', ids).eq('status', 'confirmed');
    const users = new Set<string>();
    for (const cid of Array.from(new Set((ps ?? []).map((p: any) => p.company_id as string)))) (await memberIds(cid)).forEach((u) => users.add(u));
    await notifyUsers({ userIds: Array.from(users), projectId: null, kind: 'bid', path: '/collaborate', title, body });
  } catch { /* team tables not created yet */ }
}

/** Both companies must be verified by Jobfile and not hidden. */
export async function isVerified(companyId: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from('companies').select('verified_at,hidden_at').eq('id', companyId).maybeSingle<any>();
  return !!data?.verified_at && !data?.hidden_at;
}

export const PARTNER_MAX_MI = 50;
export type LocalPartner = { id: string; name: string; open: boolean; miles: number };

/**
 * Partners must be local. A company qualifies when it is verified, not hidden, and its business ZIP is inside its own
 * service distance of the project's ZIP (the same rule that decides who hears about a job), and within 50 miles of the lead.
 * A company with no business ZIP never qualifies. Closest first, companies open to partnering ahead of the rest.
 */
export async function localPartners(projectZip: string, leadId: string, o: { q?: string; ids?: string[]; openOnly?: boolean } = {}): Promise<LocalPartner[]> {
  const db = supabaseAdmin();
  const { data: lead } = await db.from('companies').select('business_zip').eq('id', leadId).maybeSingle<any>();
  let query = db.from('companies').select('id,name,business_zip,service_radius_mi,open_to_partner').not('verified_at', 'is', null).is('hidden_at', null).not('business_zip', 'is', null).neq('id', leadId).limit(300);
  if (o.ids) query = query.in('id', o.ids.length ? o.ids : ['00000000-0000-0000-0000-000000000000']);
  if (o.q) query = query.ilike('name', `%${o.q.replace(/[%_]/g, '')}%`);
  if (o.openOnly) query = query.eq('open_to_partner', true);
  const { data } = await query;
  const rows = ((data ?? []) as any[]).filter((c) => /^\d{5}$/.test(c.business_zip ?? ''));
  if (!rows.length || !/^\d{5}$/.test(projectZip)) return [];
  const leadZip = /^\d{5}$/.test(lead?.business_zip ?? '') ? (lead.business_zip as string) : '';
  const coords = await zipCoords([projectZip, leadZip, ...rows.map((c) => c.business_zip as string)].filter(Boolean));
  const job = coords.get(projectZip);
  if (!job) return [];
  const leadAt = leadZip ? coords.get(leadZip) : undefined;
  return rows.map((c) => {
    const at = coords.get(c.business_zip as string);
    if (!at) return null;
    const d = miles(job, at);
    const radius = (c.service_radius_mi as number | null) ?? DEFAULT_RADIUS;
    if (d > radius) return null;
    if (leadAt && miles(leadAt, at) > PARTNER_MAX_MI) return null;
    return { id: c.id as string, name: (c.name as string) || 'Contractor', open: !!c.open_to_partner, miles: d };
  }).filter((x): x is LocalPartner => !!x).sort((a, b) => Number(b.open) - Number(a.open) || a.miles - b.miles).slice(0, 12);
}
