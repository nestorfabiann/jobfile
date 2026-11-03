import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { marketplaceEnabled } from '@/lib/marketplace';
import { landingStats, publicListings } from '@/lib/publicMarketplace';
import PublicJobCard from '@/components/PublicJobCard';
import LandingPitch from '@/components/LandingPitch';
import { aiConfigured } from '@/lib/marketplaceAI';

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
  return (
    <>
      {signedIn && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Link className="pill" href="/projects">Go to Projects →</Link>
        </div>
      )}
      <div className="stack">
        <span className="lbl">Home improvement marketplace</span>
        <h1 style={{ fontSize: 'clamp(32px, 9vw, 44px)', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
          Post it. Bid on it. <span style={{ color: 'var(--accent)' }}>Run the job in one place.</span>
        </h1>
        <p className="muted" style={{ fontSize: 17 }}>Homeowners post projects and compare bids from local contractors. Contractors find nearby work and keep the paperwork, photos and payments in one shared record.</p>
      </div>
      <Link className="btn accent" href={signedIn ? '/marketplace/new' : `/login?next=${encodeURIComponent('/marketplace/new')}`}>Post a Project →</Link>
      <Link className="btn" style={{ background: 'var(--ink)', borderColor: 'var(--ink)', color: 'var(--bg)' }} href={signedIn ? '/marketplace' : '/jobs'}>Find Work near you →</Link>

      {nums.length > 0 && (
        <div className="row" style={{ justifyContent: 'space-around', textAlign: 'center' }} aria-label="Jobfile so far">
          {nums.map(([n, t]) => (
            <div key={t}><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)' }}>{n}</div><div className="muted small">{t}</div></div>
          ))}
        </div>
      )}

      <LandingPitch aiOn={aiConfigured()} signedIn={signedIn} />

      <section className="card why" aria-label="Bring your own contractor or customer">
        <span className="pill ok" style={{ width: 'max-content' }}>You do not need the marketplace</span>
        <h2 style={{ fontSize: 24 }}>Already have a contractor or a customer?</h2>
        <p className="muted" style={{ margin: 0 }}>Jobfile works for any job, even if you never found each other here. Invite them by email and keep the whole job in one place.</p>
        <div className="stack" style={{ gap: 10 }}>
          {([
            ['Start the project.', 'Add the job name and who it is with.'],
            ['Send an invite.', 'They get an email and join with one tap. Nothing to download.'],
            ['Run it together.', 'Price and scope, photos, payments, change orders and messages.'],
          ] as [string, string][]).map(([t, d], i) => (
            <div key={t} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 10 }}>
              <span className="why-num" aria-hidden="true">{i + 1}</span>
              <span><b>{t}</b> {d}</span>
            </div>
          ))}
        </div>
        <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Link className="btn ghost" style={{ padding: '9px 8px', whiteSpace: 'nowrap' }} href={signedIn ? '/invites/new' : `/login?next=${encodeURIComponent('/invites/new')}`}>I&apos;m a homeowner</Link>
          <Link className="btn ghost" style={{ padding: '9px 8px', whiteSpace: 'nowrap' }} href={signedIn ? '/projects' : `/login?next=${encodeURIComponent('/projects')}`}>I&apos;m a contractor</Link>
        </div>
        <p className="muted small" style={{ margin: 0 }}>Free to start. The person you invite does not need an account first.</p>
      </section>

      <div className="stack" style={{ marginTop: 10 }}>
        <h2 style={{ margin: 0 }}>Open near you</h2>
        <p className="muted" style={{ margin: 0 }}>{signedIn ? 'Open projects from homeowners near you.' : 'Anyone can browse. Sign in to bid or post.'}</p>
      </div>
      {listings.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>No open projects right now. Be the first to post one.</p></div>
      ) : (
        listings.map((l) => <PublicJobCard key={l.id} l={l} bids={counts.get(l.id) ?? 0} />)
      )}
      <Link className="btn ghost" href="/jobs">See all open jobs →</Link>

      <Link className="btn accent" href={signedIn ? '/projects' : '/login'}>{signedIn ? 'Go to Projects →' : 'Get started free →'}</Link>
    </>
  );
}
