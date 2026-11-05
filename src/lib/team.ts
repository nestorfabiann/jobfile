import { supabaseAdmin } from '@/lib/supabase/server';

export type TeamBid = {
  id: string; listing_id: string; lead_company_id: string; lead_user_id: string; lead_cents: number; weeks: number | null; start_date: string | null;
  inclusions: string; note: string; status: 'pending' | 'sent' | 'canceled'; bid_id: string | null; created_at: string; updated_at: string;
};
export type TeamPartner = {
  id: string; team_bid_id: string; company_id: string; scope: string; price_cents: number; counter_cents: number | null;
  status: 'invited' | 'countered' | 'confirmed' | 'declined'; created_at: string; updated_at: string;
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

/** Invites waiting for a company's answer. Zero when the team tables do not exist yet. */
export async function inviteCount(userId: string): Promise<number> {
  try {
    const co = await companyOf(userId);
    if (!co) return 0;
    const { data: ps } = await supabaseAdmin().from('team_partners').select('team_bid_id').eq('company_id', co.id).eq('status', 'invited');
    const ids = (ps ?? []).map((p: any) => p.team_bid_id as string);
    if (!ids.length) return 0;
    const { count } = await supabaseAdmin().from('team_bids').select('id', { count: 'exact', head: true }).in('id', ids).eq('status', 'pending');
    return count ?? 0;
  } catch { return 0; }
}

/** Both companies must be verified by Jobfile and not hidden. */
export async function isVerified(companyId: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from('companies').select('verified_at,hidden_at').eq('id', companyId).maybeSingle<any>();
  return !!data?.verified_at && !data?.hidden_at;
}
