import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { listingTitle, requireMarketplace } from '@/lib/marketplace';
import { publicListing } from '@/lib/publicMarketplace';
import RangeBar from '@/components/RangeBar';

export const dynamic = 'force-dynamic';

export default async function PublicJob({ params }: { params: { id: string } }) {
  requireMarketplace();
  const found = await publicListing(params.id);
  if (!found) return notFound();
  const { listing: l, bids, open } = found;

  const { data: { user } } = await supabaseServer().auth.getUser();
  let isPro = false;
  if (user) {
    if (l.homeowner_id === user.id) redirect(`/marketplace/${l.id}`);
    const { data: mem } = await supabaseAdmin().from('company_members').select('company_id').eq('user_id', user.id).limit(1);
    isPro = (mem ?? []).length > 0;
    if (isPro) redirect(`/marketplace/${l.id}`);
  }

  const hasAI = l.ai_low_cents != null && l.ai_high_cents != null;
  const likely = (l.ai_likely_cents ?? l.ai_low_cents) as number;
  return (
    <>
      <div className="stack">
        <Link href="/jobs" className="small">‹ All jobs</Link>
        <h1>{listingTitle(l)}</h1>
        <div className="row">
          <span className="pill">{l.job_type}</span>
          <span className={`pill ${open ? 'ok' : ''}`}>{open ? 'Open for bids' : 'Closed'}</span>
        </div>
        <p className="muted small">{[l.city, `ZIP ${l.zip}`, l.size_sqft ? `${l.size_sqft.toLocaleString('en-US')} sq ft` : '', `${bids} bid${bids === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="card">
        <h2 style={{ margin: 0 }}>Scope of work</h2>
        {l.items.length > 0 ? <ul style={{ margin: 0, paddingLeft: 20 }}>{l.items.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="muted">No items listed.</p>}
      </div>

      {hasAI && (
        <div className="card">
          <div className="row"><span className="pill warn">✦ AI cost reference</span></div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{dollars(l.ai_low_cents as number)} – {dollars(l.ai_high_cents as number)}</div>
          <p className="muted small" style={{ margin: 0 }}>Typical range for this scope in the area. Most likely about {dollars(likely)}.</p>
          <RangeBar price={likely} lo={l.ai_low_cents as number} hi={l.ai_high_cents as number} />
          {(l.ai_breakdown ?? []).map((b) => (
            <div className="row small" key={b.group} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><span>{b.group}</span><b>{dollars(b.low * 100)}–{dollars(b.high * 100)}</b></div>
          ))}
          <p className="muted small" style={{ margin: 0 }}>A reference only, not a quote. Final price comes from contractor bids.</p>
        </div>
      )}

      <div className="box warn">Hidden until you sign in as a contractor: photos, the homeowner&apos;s notes and budget, and who else has bid. The street address is shared only with the contractor the homeowner hires.</div>

      {!user && open && (
        <>
          <Link className="btn accent" href={`/login?next=${encodeURIComponent(`/marketplace/${l.id}`)}`}>Sign in to bid on this job</Link>
          <p className="muted small" style={{ textAlign: 'center' }}>Free to look and bid. You come right back to this job after signing in.</p>
        </>
      )}
      {user && !isPro && (
        <div className="card"><p style={{ margin: 0 }}>Bidding is for contractor accounts. Add your business in <Link href="/settings">Settings</Link> to bid on jobs like this one.</p></div>
      )}
    </>
  );
}
