import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';
import { NEXT_COOKIE, safeNext } from '@/lib/nextPath';
import { REF_COOKIE, recordJoin } from '@/lib/referrals';

// The sign-in email links here. The token_hash style works in any browser; the code style (Supabase default email) needs the same browser.
export async function GET(req: NextRequest) {
  const base = process.env.APP_URL || req.url;
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type') as EmailOtpType | null;
  const code = req.nextUrl.searchParams.get('code');
  const dest = safeNext(req.cookies.get(NEXT_COOKIE)?.value) || '/projects';
  const done = async () => {
    try {
      const { data: { user } } = await supabaseServer().auth.getUser();
      if (user) await recordJoin({ id: user.id, created_at: user.created_at }, req.cookies.get(REF_COOKIE)?.value);
    } catch { /* never block sign-in */ }
    const res = NextResponse.redirect(new URL(dest, base));
    res.cookies.delete(NEXT_COOKIE);
    return res;
  };

  // Default Supabase email link (PKCE): needs the same browser that asked for the link.
  if (code) {
    const { error } = await supabaseServer().auth.exchangeCodeForSession(code);
    if (!error) return await done();
  }

  if (tokenHash && type) {
    const { error } = await supabaseServer().auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return await done();
  }
  return NextResponse.redirect(new URL('/login?error=1', base));
}
