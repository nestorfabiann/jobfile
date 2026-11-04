import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { pageName } from '@/lib/usage';

/** Records a page view or a "still here" ping for the signed-in person. Never throws and never blocks the page. */
export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await supabaseServer().auth.getUser();
    if (!user) return new NextResponse(null, { status: 204 });
    const body = await req.json().catch(() => ({}));
    const kind = body?.kind === 'ping' ? 'ping' : 'view';
    const page = pageName(String(body?.path ?? '/').slice(0, 300));
    if (page === 'Admin') return new NextResponse(null, { status: 204 });
    const db = supabaseAdmin();
    if (kind === 'view' && body?.app === true) {
      const device = ['iPhone', 'Android', 'Desktop'].includes(String(body?.device)) ? String(body.device) : '';
      try { await db.from('app_installs').upsert({ user_id: user.id, device, last_seen: new Date().toISOString() }, { onConflict: 'user_id' }); } catch { /* table not created yet */ }
    }
    const { data: last } = await db.from('usage_events').select('page,kind,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
    const prev = (last ?? [])[0] as { page: string; kind: string; created_at: string } | undefined;
    const age = prev ? Date.now() - new Date(prev.created_at).getTime() : Infinity;
    if (kind === 'view' && prev && prev.page === page && age < 20_000) return new NextResponse(null, { status: 204 });
    if (kind === 'ping' && age < 45_000) return new NextResponse(null, { status: 204 });
    await db.from('usage_events').insert({ user_id: user.id, kind, page });
  } catch { /* tracking must never break anything */ }
  return new NextResponse(null, { status: 204 });
}
