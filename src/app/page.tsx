import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { marketplaceEnabled } from '@/lib/marketplace';
import { landingStats, publicListings } from '@/lib/publicMarketplace';
import PublicJobCard from '@/components/PublicJobCard';
import LandingModern from '@/components/LandingModern';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!marketplaceEnabled()) redirect(user ? '/projects' : '/login');
  const signedIn = !!user;

  const { listings, counts } = await publicListings('', 3);
  const st = await landingStats();
  const nums: [string, string][] = [];
  if (st.posted) nums.push([st.posted.toLocaleString('en-US'), 'Projects posted']);
  if (st.pros) nums.push([st.pros.toLocaleString('en-US'), 'Local pros']);
  if (st.rating) nums.push([`${st.rating.avg.toFixed(1)} ★`, `Avg. rating (${st.rating.count})`]);
  const inv = (to: string) => (signedIn ? to : `/login?next=${encodeURIComponent(to)}`);
  return (
    <div className="landing">
      {signedIn && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Link className="pill" href="/projects">Go to Projects →</Link>
        </div>
      )}
      <LandingModern signedIn={signedIn} nums={nums}>
        <section className="lm-have" aria-label="Bring your own contractor or customer">
          <h2>Already have a contractor or a customer?</h2>
          <p className="muted" style={{ margin: 0 }}>Jobfile works for any job. Invite them by email, free, no account needed first.</p>
          <div className="two">
            <Link className="btn ghost" style={{ padding: '9px 8px', whiteSpace: 'nowrap' }} href={inv('/invites/new')}>I&apos;m a homeowner</Link>
            <Link className="btn ghost" style={{ padding: '9px 8px', whiteSpace: 'nowrap' }} href={inv('/projects')}>I&apos;m a contractor</Link>
          </div>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>How inviting works</summary>
            <ol className="lm-inv" style={{ marginTop: 10 }}>
              <li><b>Start the project.</b> Add the job name and who it is with.</li>
              <li><b>Send an invite.</b> They join with one tap. Nothing to download.</li>
              <li><b>Run it together.</b> Price, photos, payments, change orders and messages.</li>
            </ol>
          </details>
        </section>

        <section className="stack" style={{ gap: 12 }} aria-label="Open near you">
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.035em' }}>Open near you</h2>
          <p className="muted" style={{ margin: 0 }}>{signedIn ? 'Open projects from homeowners near you.' : 'Anyone can browse. Sign in to bid or post.'}</p>
          {listings.length === 0 ? (
            <div className="card"><p className="muted" style={{ margin: 0 }}>No open projects right now. Be the first to post one.</p></div>
          ) : (
            listings.map((l) => <PublicJobCard key={l.id} l={l} bids={counts.get(l.id) ?? 0} />)
          )}
          <Link className="btn ghost" href="/jobs">See all open jobs →</Link>
        </section>
      </LandingModern>
    </div>
  );
}
