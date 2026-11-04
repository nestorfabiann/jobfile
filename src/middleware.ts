import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Keeps the login session fresh and sends signed-out visitors to the login page.
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  // Public marketplace pages (landing and open jobs) are visible when signed out, only while the marketplace is on.
  const publicMarket = process.env.MARKETPLACE_ENABLED === 'true' && (path === '/' || path === '/jobs' || path.startsWith('/jobs/'));
  const isOpen = path.startsWith('/login') || path.startsWith('/auth') || path.startsWith('/unsubscribe') || path === '/help' || path === '/app' || path === '/manifest.webmanifest' || path.startsWith('/icons/') || path.startsWith('/r/') || publicMarket;

  if (!user && !isOpen) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (user && path === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/projects';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
