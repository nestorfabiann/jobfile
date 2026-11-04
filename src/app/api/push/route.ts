import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { cleanPrefs, pushConfigured } from '@/lib/push';

export const dynamic = 'force-dynamic';

/** Phone alert status and changes for the signed-in person. Never throws. */
export async function GET(req: NextRequest) {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
  if (!pushConfigured()) return NextResponse.json({ configured: false });
  try {
    const { data: { user } } = await supabaseServer().auth.getUser();
    if (!user) return NextResponse.json({ configured: true, key, endpoints: [] });
    const { data } = await supabaseAdmin().from('push_subscriptions').select('endpoint,prefs').eq('user_id', user.id);
    const rows = (data ?? []) as { endpoint: string; prefs: unknown }[];
    const ep = req.nextUrl.searchParams.get('endpoint') ?? '';
    const mine = rows.find((r) => r.endpoint === ep);
    return NextResponse.json({ configured: true, key, subscribed: !!mine, prefs: mine ? cleanPrefs(mine.prefs) : null });
  } catch {
    return NextResponse.json({ configured: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await supabaseServer().auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const b = await req.json().catch(() => ({}));
    const db = supabaseAdmin();
    if (b.action === 'subscribe') {
      const s = b.subscription ?? {};
      const endpoint = String(s.endpoint ?? '');
      const p256dh = String(s.keys?.p256dh ?? '');
      const auth = String(s.keys?.auth ?? '');
      if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return NextResponse.json({ ok: false }, { status: 400 });
      const { error } = await db.from('push_subscriptions').upsert(
        { user_id: user.id, endpoint, p256dh, auth, user_agent: String(req.headers.get('user-agent') ?? '').slice(0, 200) },
        { onConflict: 'endpoint' },
      );
      return NextResponse.json({ ok: !error });
    }
    const endpoint = String(b.endpoint ?? '');
    if (b.action === 'unsubscribe') {
      await db.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'prefs') {
      const { error } = await db.from('push_subscriptions').update({ prefs: cleanPrefs(b.prefs) }).eq('user_id', user.id).eq('endpoint', endpoint);
      return NextResponse.json({ ok: !error });
    }
    return NextResponse.json({ ok: false }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
