import { supabaseAdmin } from '@/lib/supabase/server';
import { miles, zipCoords } from '@/lib/matching';
import { PARTNER_MAX_MI } from '@/lib/team';

export type ProjectPartner = {
  id: string; project_id: string; lead_company_id: string; invited_by: string; partner_company_id: string | null;
  partner_name: string; partner_email: string; scope: string; price_cents: number; counter_cents: number | null;
  start_date: string | null; end_date: string | null; paid_cents: number;
  status: 'invited' | 'countered' | 'accepted' | 'declined' | 'removed'; removed_by: string | null; created_at: string; updated_at: string;
};
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PSTATUS: Record<ProjectPartner['status'], string> = { invited: 'Invited', countered: 'New price proposed', accepted: 'On the job', declined: 'Declined', removed: 'Removed' };

/** True when both ZIPs are known and within the 50 mile partner limit. Unknown ZIPs return null. */
export async function withinPartnerRange(zipA: string | null | undefined, zipB: string | null | undefined): Promise<boolean | null> {
  const a = (zipA ?? '').trim(), b = (zipB ?? '').trim();
  if (!/^\d{5}$/.test(a) || !/^\d{5}$/.test(b)) return null;
  const c = await zipCoords([a, b]);
  const pa = c.get(a), pb = c.get(b);
  if (!pa || !pb) return null;
  return miles(pa, pb) <= PARTNER_MAX_MI;
}

/** Partner rows this company is on, matched by company or by the email it signed up with. */
export async function myPartnerRows(userId: string, companyId: string | null): Promise<ProjectPartner[]> {
  try {
    const db = supabaseAdmin();
    const { data: prof } = await db.from('profiles').select('email').eq('id', userId).maybeSingle<any>();
    const email = ((prof?.email as string | undefined) ?? '').toLowerCase();
    const ors: string[] = [];
    if (companyId) ors.push(`partner_company_id.eq.${companyId}`);
    if (email) ors.push(`partner_email.eq.${email.replace(/[,()]/g, '')}`);
    if (!ors.length) return [];
    const { data } = await db.from('project_partners').select('*').or(ors.join(',')).neq('status', 'removed').order('created_at', { ascending: false }).limit(100);
    return (data ?? []) as ProjectPartner[];
  } catch { return []; }
}

/** Invites waiting on this person as a partner, for the menu tag. Zero when the table does not exist yet. */
export async function partnerInviteCount(userId: string, companyId: string | null): Promise<number> {
  const rows = await myPartnerRows(userId, companyId);
  return rows.filter((r) => r.status === 'invited').length;
}

/** A partner row if this person may see it as the partner (their company, or the invited email). */
export async function partnerFor(userId: string, companyId: string | null, id: string): Promise<ProjectPartner | null> {
  const rows = await myPartnerRows(userId, companyId);
  return rows.find((r) => r.id === id) ?? null;
}
