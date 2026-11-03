import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';

/** The signed-in person's company id (first membership), or null for a homeowner. */
export async function myCompanyId(): Promise<string | null> {
  const { user } = await requireUser();
  const { data } = await supabaseAdmin().from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  return ((data ?? [])[0]?.company_id as string | undefined) ?? null;
}
