import { supabaseAdmin } from '@/lib/supabase/server';

/** Unread Community alerts for the menu: replies to your posts and approval notices. */
export async function communityCount(userId: string): Promise<number> {
  try {
    const { count } = await supabaseAdmin()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
      .in('kind', ['community_note', 'community'])
      .gt('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
    return Math.min(count ?? 0, 99);
  } catch {
    return 0;
  }
}
