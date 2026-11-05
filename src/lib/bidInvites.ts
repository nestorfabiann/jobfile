import { supabaseAdmin } from '@/lib/supabase/server';
import { DEFAULT_RADIUS, miles, zipCoords } from '@/lib/matching';
import { listingOpen, listingTitle } from '@/lib/marketplace';
import { memberIds } from '@/lib/team';
import { notifyUsers } from '@/lib/notify';

export const MAX_INVITES_PER_DAY = 10;
export const MAX_QUESTIONS_PER_DAY = 5;
export const MAX_GENERAL_PER_DAY = 3;

export type BidInvite = { id: string; listing_id: string | null; homeowner_id: string; company_id: string; note: string; status: 'invited' | 'asked' | 'declined'; created_at: string; updated_at: string };
export type InviteMsg = { id: string; sender_side: 'homeowner' | 'contractor'; body: string; created_at: string };

/** A company serves a ZIP when its business ZIP is inside its own service distance of that ZIP. No business ZIP means it does not. */
export async function servesZip(companyId: string, zip: string): Promise<boolean> {
  const { data: c } = await supabaseAdmin().from('companies').select('business_zip,service_radius_mi,hidden_at').eq('id', companyId).maybeSingle<any>();
  if (!c || c.hidden_at || !/^\d{5}$/.test(c.business_zip ?? '') || !/^\d{5}$/.test(zip)) return false;
  const co = await zipCoords([c.business_zip, zip]);
  const a = co.get(c.business_zip), b = co.get(zip);
  if (!a || !b) return false;
  return miles(a, b) <= ((c.service_radius_mi as number | null) ?? DEFAULT_RADIUS);
}

export type Candidate = { id: string; title: string; zip: string; daysLeft: number; bids: number };
/** The homeowner's open projects this company serves and has not been invited to yet. */
export async function inviteCandidates(userId: string, companyId: string): Promise<Candidate[]> {
  try {
    const db = supabaseAdmin();
    const { data: ls } = await db.from('marketplace_listings').select('id,job_type,items,zip,status,expires_at').eq('homeowner_id', userId).eq('status', 'open').gt('expires_at', new Date().toISOString());
    const rows = ((ls ?? []) as any[]);
    if (!rows.length) return [];
    const { data: ex } = await db.from('bid_invites').select('listing_id').eq('company_id', companyId).in('listing_id', rows.map((r) => r.id));
    const used = new Set(((ex ?? []) as any[]).map((e) => e.listing_id as string));
    const { data: bs } = await db.from('marketplace_bids').select('listing_id,company_id').in('listing_id', rows.map((r) => r.id));
    const bidCount = new Map<string, number>();
    const already = new Set<string>();
    ((bs ?? []) as any[]).forEach((b) => { bidCount.set(b.listing_id, (bidCount.get(b.listing_id) ?? 0) + 1); if (b.company_id === companyId) already.add(b.listing_id); });
    const out: Candidate[] = [];
    for (const r of rows) {
      if (used.has(r.id) || already.has(r.id)) continue;
      if (!(await servesZip(companyId, r.zip))) continue;
      out.push({ id: r.id, title: listingTitle(r), zip: r.zip, daysLeft: Math.max(0, Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / 86400000)), bids: bidCount.get(r.id) ?? 0 });
    }
    return out;
  } catch { return []; }
}

/** Creates an invite (or turns a question into an invite). Returns an error message or null. Never throws. */
export async function makeInvite(l: { id: string; homeowner_id: string; job_type: string; items: string[]; zip: string; status: string; expires_at: string }, companyId: string, note: string, status: 'invited' | 'asked'): Promise<{ error: string } | { id: string; created: boolean }> {
  try {
    const db = supabaseAdmin();
    if (!listingOpen(l)) return { error: 'This project is no longer taking bids.' };
    if (!(await servesZip(companyId, l.zip))) return { error: 'This contractor does not serve your ZIP code.' };
    const { count: mine } = await db.from('marketplace_bids').select('id', { count: 'exact', head: true }).eq('listing_id', l.id).eq('company_id', companyId);
    if ((mine ?? 0) > 0) return { error: 'This contractor already bid on that project.' };
    const { data: ex } = await db.from('bid_invites').select('id,status').eq('listing_id', l.id).eq('company_id', companyId).maybeSingle<any>();
    if (!ex) {
      // A general question asked earlier becomes part of this project, so nothing starts over.
      const { data: gen } = await db.from('bid_invites').select('id,status').is('listing_id', null).eq('homeowner_id', l.homeowner_id).eq('company_id', companyId).maybeSingle<any>();
      if (gen && gen.status !== 'declined') {
        await db.from('bid_invites').update({ listing_id: l.id, note, status: status === 'invited' ? 'invited' : gen.status, updated_at: new Date().toISOString() }).eq('id', gen.id);
        return { id: gen.id as string, created: status === 'invited' };
      }
    }
    if (ex) {
      if (ex.status === 'declined') return { error: 'This contractor passed on that project.' };
      if (ex.status === 'invited') return { error: 'You already invited this contractor to that project.' };
      if (status === 'invited') await db.from('bid_invites').update({ status: 'invited', note, updated_at: new Date().toISOString() }).eq('id', ex.id);
      return { id: ex.id as string, created: false };
    }
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count: recent } = await db.from('bid_invites').select('id', { count: 'exact', head: true }).eq('homeowner_id', l.homeowner_id).gt('created_at', since);
    if ((recent ?? 0) >= MAX_INVITES_PER_DAY) return { error: 'You sent a lot of invites today. Try again tomorrow.' };
    const { data: row, error } = await db.from('bid_invites').insert({ listing_id: l.id, homeowner_id: l.homeowner_id, company_id: companyId, note, status }).select('id').single<any>();
    if (error || !row) return { error: 'Could not send. Check that the database step was run.' };
    return { id: row.id as string, created: true };
  } catch { return { error: 'Could not send. Try again.' }; }
}

export async function tellCompany(companyId: string, l: { id: string; job_type: string; items: string[] }, title: string, body: string, path?: string) {
  try {
    await notifyUsers({ userIds: await memberIds(companyId), projectId: null, kind: 'bid', path: path ?? `/marketplace/${l.id}`, title, body, cta: 'Open the project' });
  } catch { /* never block */ }
}
// Invites: tables come from migration 041.

/** Starts (or finds) a general question thread with a company. Returns an error message or the thread id. Never throws. */
export async function makeGeneral(userId: string, companyId: string): Promise<{ error: string } | { id: string; fresh: boolean }> {
  try {
    const db = supabaseAdmin();
    const { data: pr } = await db.from('profiles').select('*').eq('id', userId).maybeSingle<any>();
    const zip = (pr?.zip as string | null) ?? '';
    if (!/^\d{5}$/.test(zip)) return { error: 'Save your ZIP code first so we can check the contractor serves your area. You can add it in Find contractors.' };
    if (!(await servesZip(companyId, zip))) return { error: 'This contractor does not serve your ZIP code.' };
    const { data: ex } = await db.from('bid_invites').select('id,status').is('listing_id', null).eq('homeowner_id', userId).eq('company_id', companyId).maybeSingle<any>();
    if (ex) {
      if (ex.status === 'declined') return { error: 'This contractor passed on your question.' };
      return { id: ex.id as string, fresh: false };
    }
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await db.from('bid_invites').select('id', { count: 'exact', head: true }).eq('homeowner_id', userId).is('listing_id', null).gt('created_at', since);
    if ((count ?? 0) >= MAX_GENERAL_PER_DAY) return { error: `You can start ${MAX_GENERAL_PER_DAY} new general questions a day. Try again tomorrow.` };
    const { data: row, error } = await db.from('bid_invites').insert({ listing_id: null, homeowner_id: userId, company_id: companyId, note: '', status: 'asked' }).select('id').single<any>();
    if (error || !row) return { error: 'Could not send. Check that the database step was run.' };
    return { id: row.id as string, fresh: true };
  } catch { return { error: 'Could not send. Try again.' }; }
}
