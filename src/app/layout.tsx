import './globals.css';
import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { supabaseServer } from '@/lib/supabase/server';
import { signOut } from './auth/actions';
import { isAdminEmail } from '@/lib/admin';
import { marketplaceEnabled } from '@/lib/marketplace';
import PubTabs from '@/components/PubTabs';

export const metadata: Metadata = {
  title: 'Jobfile',
  description: 'A shared record for home improvement projects.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const {
    data: { user },
  } = await supabaseServer().auth.getUser();

  // Signed-out visitors get the warm marketplace look (cream, orange, bottom tabs). Signed-in people keep the app look.
  const pub = !user && marketplaceEnabled();

  return (
    <html lang="en">
      <head>
        {pub && (
          // eslint-disable-next-line @next/next/no-page-custom-font
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap" />
        )}
      </head>
      <body className={pub ? 'pub' : undefined}>
        {pub ? (
          <header className="pubtop">
            <div className="in pubtop-in">
              <Link href="/" className="publogo">Job<b>file</b></Link>
              <Link href="/login" className="pubpill">Sign in</Link>
            </div>
          </header>
        ) : (
          <header className="chrome">
            <div className="in top">
              <Link href="/projects" className="brand">
                JOBFILE
              </Link>
              {user && (
                <nav aria-label="Main">
                  <Link href="/projects">Projects</Link>
                  {marketplaceEnabled() && <Link href="/marketplace">Marketplace</Link>}
                  <Link href="/settings">Settings</Link>
                  {isAdminEmail(user.email, !!user.email_confirmed_at) && <Link href="/admin">Admin</Link>}
                  <form action={signOut}>
                    <button className="linkbtn">Sign out</button>
                  </form>
                </nav>
              )}
            </div>
          </header>
        )}
        <main className="in">{children}</main>
        {pub && <PubTabs />}
      </body>
    </html>
  );
}
