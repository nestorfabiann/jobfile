import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { marketplaceEnabled } from '@/lib/marketplace';
import { contractorFit, isContractor, landingStats, listingThumbs, publicListings } from '@/lib/publicMarketplace';
import PublicJobCard from '@/components/PublicJobCard';
import LandingModern from '@/components/LandingModern';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!marketplaceEnabled()) redirect(user ? '/projects' : '/login');
  const signedIn = !!user;

  const { listings, counts } = await publicListings('', 3);
  const thumbs = (await isContractor(user?.id)) ? await listingThumbs(listings.map((l) => l.id)) : null;
  const fits = thumbs && user ? await contractorFit(user.id, listings) : null;
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
          <span className="lm-envl" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3.5 7l8.5 6 8.5-6" /></svg>
          </span>
          <h2>Already have a contractor or a customer?</h2>
          <p className="muted" style={{ margin: 0 }}>Jobfile works for any job. Invite them by email, free, no account needed first.</p>
          <div className="two">
            <Link className="lm-ib fill" href={inv('/invites/new')}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>
              I&apos;m a homeowner
            </Link>
            <Link className="lm-ib" href={inv('/projects')}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.5-2.5z" /></svg>
              I&apos;m a contractor
            </Link>
          </div>
          <ol className="lm-isteps">
            <li><span className="lm-in">1</span><span><b>Start it</b>Add the job and who it is with.</span></li>
            <li><span className="lm-in">2</span><span><b>Send invite</b>They join with one tap.</span></li>
            <li><span className="lm-in">3</span><span><b>Run it</b>Price, photos, payments.</span></li>
          </ol>
        </section>

        <section className="stack" style={{ gap: 12 }} aria-label="Open near you">
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.035em' }}>Open near you</h2>
          <p className="muted" style={{ margin: 0 }}>{signedIn ? 'Open projects from homeowners near you.' : 'Anyone can browse. Sign in to bid or post.'}</p>
          {listings.length === 0 ? (
            <div className="card"><p className="muted" style={{ margin: 0 }}>No open projects right now. Be the first to post one.</p></div>
          ) : (
            listings.map((l) => <PublicJobCard key={l.id} l={l} bids={counts.get(l.id) ?? 0} photos={thumbs?.get(l.id)} fit={fits?.get(l.id)} />)
          )}
          <Link className="btn ghost" href="/jobs">See all open jobs →</Link>
        </section>
      </LandingModern>
    </div>
  );
}
