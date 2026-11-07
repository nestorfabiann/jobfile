import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Health check for uptime monitoring. Says whether the app can reach its database.
 * It returns no data from the database and needs no login.
 */
export async function GET() {
  const t0 = Date.now();
  try {
    const { error } = await supabaseAdmin().from('profiles').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) return NextResponse.json({ ok: false, db: 'error' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ ok: true, db: 'ok', ms: Date.now() - t0 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, db: 'down' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
