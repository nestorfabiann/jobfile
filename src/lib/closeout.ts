import { supabaseAdmin } from '@/lib/supabase/server';

export type Confirm = { role: 'homeowner' | 'contractor'; scope: Record<string, string>; homeowner_paid_cents: number | null; payment_answer: 'received' | 'not_received' | null; note: string; confirmed_at: string };

/** Both sides' closeout confirmations for a project. Empty when nobody confirmed yet or the 042 table is missing. */
export async function loadConfirms(projectId: string): Promise<{ homeowner: Confirm | null; contractor: Confirm | null }> {
  try {
    const { data } = await supabaseAdmin().from('closeout_confirms').select('role,scope,homeowner_paid_cents,payment_answer,note,confirmed_at').eq('project_id', projectId);
    const rows = (data ?? []) as Confirm[];
    return { homeowner: rows.find((r) => r.role === 'homeowner') ?? null, contractor: rows.find((r) => r.role === 'contractor') ?? null };
  } catch { return { homeowner: null, contractor: null }; }
}
