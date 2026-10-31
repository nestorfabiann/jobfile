import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';

// The sign-in email links here. It works even when the link opens in a different browser than the one that asked for it.
export async function GET(req: NextRequest) {
  const base = process.env.APP_URL || req.url;
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type') as EmailOtpType | null;

  if (tokenHash && type) {
    const { error } = await supabaseServer().auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL('/projects', base));
  }
  return NextResponse.redirect(new URL('/login?error=1', base));
}
