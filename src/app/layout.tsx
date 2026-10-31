import './globals.css';
import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { supabaseServer } from '@/lib/supabase/server';
import { signOut } from './auth/actions';

export const metadata: Metadata = {
  title: 'Jobfile',
  description: 'A shared record for home improvement projects.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const {
    data: { user },
  } = await supabaseServer().auth.getUser();

  return (
    <html lang="en">
      <body>
        <header className="chrome">
          <div className="in top">
            <Link href="/projects" className="brand">
              JOBFILE
            </Link>
            {user && (
              <nav aria-label="Main">
                <Link href="/projects">Projects</Link>
                <Link href="/settings">Settings</Link>
                <form action={signOut}>
                  <button className="linkbtn">Sign out</button>
                </form>
              </nav>
            )}
          </div>
        </header>
        <main className="in">{children}</main>
      </body>
    </html>
  );
}
