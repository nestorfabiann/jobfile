import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { REF_COOKIE, validCode } from '@/lib/referrals';

export const dynamic = 'force-dynamic';

/** An invite link. Remembers who invited this visitor for 30 days, counts the open once, then goes Home. */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const res = NextResponse.redirect(new URL('/', process.env.APP_URL || req.url), 303);
  try {
    if (!validCode(code)) return res;
    const db = supabaseAdmin();
    const { data: owner } = await db.from('invite_codes').select('user_id').eq('code', code).maybeSingle();
    if (!owner) return res;
    if (req.cookies.get(REF_COOKIE)?.value !== code) {
      await db.from('invite_events').insert({ code, kind: 'open' });
    }
    res.cookies.set(REF_COOKIE, code, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 });
  } catch { /* still go Home */ }
  return res;
}
