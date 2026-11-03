import './globals.css';
import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { signOut } from './auth/actions';
import { isAdminEmail } from '@/lib/admin';
import { marketplaceEnabled } from '@/lib/marketplace';
import PubTabs from '@/components/PubTabs';
import AppMenu from '@/components/AppMenu';
import AppTabs from '@/components/AppTabs';
import { needsCount } from '@/lib/needsCount';

export const metadata: Metadata = {
  title: 'Jobfile',
  description: 'A shared record for home improvement projects.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const {
    data: { user },
  } = await supabaseServer().auth.getUser();

  // Everyone gets the warm marketplace look (cream, orange, Bricolage headings). Signed-out visitors also get a bottom tab bar.
  const tabs = !user && marketplaceEnabled();

  // Signed-in tab bar: contractors see Find work, everyone else sees Post. The badge matches the "Needs you" card.
  let contractor = false;
  let waiting = 0;
  if (user) {
    try {
      const db = supabaseAdmin();
      const m = await db.from('company_members').select('company_id', { count: 'exact', head: true }).eq('user_id', user.id);
      contractor = (m.count ?? 0) > 0;
      waiting = await needsCount(user.id);
    } catch { /* the bar still shows, without the badge */ }
  }

  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap" />
      </head>
      <body className={tabs || user ? 'pub withtabs' : 'pub'}>
        {tabs ? (
          <header className="pubtop">
            <div className="in pubtop-in">
              <Link href="/" className="publogo">Job<b>file</b></Link>
              <Link href="/login" className="pubpill">Sign in</Link>
            </div>
          </header>
        ) : (
          <header className="pubtop app">
            <div className="in pubtop-in">
              <Link href="/" className="publogo">Job<b>file</b></Link>
              {user && <AppMenu marketplace={marketplaceEnabled()} admin={isAdminEmail(user.email, !!user.email_confirmed_at)} signOutAction={signOut} />}
            </div>
          </header>
        )}
        <main className="in">{children}</main>
        {tabs && <PubTabs />}
        {user && <AppTabs contractor={contractor} marketplace={marketplaceEnabled()} waiting={waiting} admin={isAdminEmail(user.email, !!user.email_confirmed_at)} signOutAction={signOut} />}
      </body>
    </html>
  );
}
