import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { marketplaceEnabled } from '@/lib/marketplace';
import { publicListings } from '@/lib/publicMarketplace';
import PublicJobCard from '@/components/PublicJobCard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (user) redirect('/projects');
  if (!marketplaceEnabled()) redirect('/login');

  const { listings, counts } = await publicListings('', 3);
  const steps: [string, string][] = [
    ['📝 Post your project', 'Tap the work you want done, add photos, set a budget range and location in minutes.'],
    ['🔨 Compare bids', 'Local contractors send proposals. Review them side by side.'],
    ['✦ Know fair pricing', 'Get an AI cost reference before you commit.'],
    ['📂 Run the job in Jobfile', 'Accept a bid and the project opens with scope, price, photos, payments and change orders.'],
  ];
  return (
    <>
      <div className="stack">
        <span className="lbl">Home improvement marketplace</span>
        <h1 style={{ fontSize: 'clamp(32px, 9vw, 44px)', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
          Post it. Compare bids. Build it <span style={{ color: 'var(--accent)' }}>for a fair price.</span>
        </h1>
        <p className="muted" style={{ fontSize: 17 }}>Homeowners post projects, local contractors bid, and our AI shows you what the job should cost in your area. Then Jobfile keeps the whole job organized.</p>
      </div>
      <Link className="btn accent" href={`/login?next=${encodeURIComponent('/marketplace/new')}`}>Post a Project →</Link>
      <Link className="btn ghost" href="/jobs">🔍 Find Work</Link>

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
          <Link className="btn ghost" href={`/login?next=${encodeURIComponent('/invites/new')}`}>I&apos;m a homeowner</Link>
          <Link className="btn ghost" href={`/login?next=${encodeURIComponent('/projects')}`}>I&apos;m a contractor</Link>
        </div>
        <p className="muted small" style={{ margin: 0 }}>Free to start. The person you invite does not need an account first.</p>
      </section>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        {['Projects posted', 'Local pros', 'Avg. rating'].map((t) => (
          <div key={t}><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)' }}>—</div><div className="muted small">{t}</div></div>
        ))}
      </div>
      <p className="muted small" style={{ margin: 0 }}>Numbers stay blank until they&apos;re real. We won&apos;t show made-up stats.</p>

      <div className="stack" style={{ marginTop: 10 }}>
        <h2 style={{ margin: 0 }}>Open near you</h2>
        <p className="muted" style={{ margin: 0 }}>Anyone can browse. Sign in to bid or post.</p>
      </div>
      {listings.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>No open projects right now. Be the first to post one.</p></div>
      ) : (
        listings.map((l) => <PublicJobCard key={l.id} l={l} bids={counts.get(l.id) ?? 0} />)
      )}
      <Link className="btn ghost" href="/jobs">See all open jobs →</Link>

      <h2 style={{ margin: '14px 0 0' }}>How it works</h2>
      {steps.map(([t, d]) => (
        <div className="card" key={t}><h3 style={{ margin: 0 }}>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>
      ))}
      <Link className="btn accent" href="/login">Get started free →</Link>
    </>
  );
}
