import { supabaseAdmin } from '@/lib/supabase/server';

export const LEAD_DAYS = 60;
export const LEAD_NOTE = 'Started a project with you';

/**
 * Contractors who opened a project for this homeowner in the last 60 days and do this kind of work.
 * A company with no trades listed counts as a match. Never throws.
 */
export async function leadCompanies(email: string | null | undefined, jobType?: string): Promise<{ id: string; name: string; trades: string[] }[]> {
  try {
    if (!email) return [];
    const since = new Date(Date.now() - LEAD_DAYS * 86400_000).toISOString();
    const { data } = await supabaseAdmin()
      .from('projects')
      .select('company_id, companies(name,trades,hidden_at)')
      .eq('homeowner_email', email.toLowerCase())
      .gt('created_at', since);
    const seen = new Map<string, { name: string; trades: string[] }>();
    for (const r of (data ?? []) as any[]) {
      const c = r.companies;
      if (!c || c.hidden_at) continue;
      const trades: string[] = c.trades ?? [];
      if (jobType && trades.length && !trades.includes(jobType)) continue;
      seen.set(r.company_id as string, { name: c.name as string, trades });
    }
    return Array.from(seen, ([id, v]) => ({ id, name: v.name, trades: v.trades }));
  } catch {
    return [];
  }
}
