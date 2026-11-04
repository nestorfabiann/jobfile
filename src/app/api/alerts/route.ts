import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** New unread alerts for the signed-in person since a time, for the alert pill. Never throws. */
export async function GET(req: NextRequest) {
  try {
    const { data: { user } } = await supabaseServer().auth.getUser();
    if (!user) return NextResponse.json({ alerts: [] });
    const raw = req.nextUrl.searchParams.get('since') ?? '';
    const t = new Date(raw).getTime();
    const since = Number.isFinite(t) ? new Date(Math.max(t, Date.now() - 10 * 60_000)).toISOString() : new Date(Date.now() - 60_000).toISOString();
    const { data } = await supabaseAdmin()
      .from('notifications')
      .select('id,kind,title,body,created_at')
      .eq('user_id', user.id)
      .is('read_at', null)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .limit(5);
    return NextResponse.json({ alerts: data ?? [] });
  } catch {
    return NextResponse.json({ alerts: [] });
  }
}
