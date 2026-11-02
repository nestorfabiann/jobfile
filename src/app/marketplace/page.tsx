import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { firstNameInitial, JOB_TYPES, listingOpen, listingTitle, requireMarketplace, type Listing } from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });
const budget = (l: Listing) =>
  l.budget_min_cents || l.budget_max_cents ? [l.budget_min_cents, l.budget_max_cents].filter((x) => x != null).map((x) => dollars(x as number)).join(' – ') : '';

export default async function Marketplace({ searchParams }: { searchParams: { type?: string; error?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  const companyId = (mem ?? [])[0]?.company_id as string | undefined;
  const isPro = !!companyId;
  const type = searchParams.type && JOB_TYPES[searchParams.type] ? searchParams.type : '';

  let q = db.from('marketplace_listings').select('*').order('created_at', { ascending: false }).limit(60);
  q = isPro ? q.eq('status', 'open').gt('expires_at', new Date().toISOString()) : q.eq('homeowner_id', user.id);
  if (isPro && type) q = q.eq('job_type', type);
  const { data } = await q;
  const listings = (data ?? []) as Listing[];

  const ids = listings.map((l) => l.id);
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  if (ids.length) {
    const { data: bids } = await db.from('marketplace_bids').select('listing_id,company_id,status').in('listing_id', ids);
    (bids ?? []).forEach((b: any) => {
      if (b.status !== 'withdrawn') counts.set(b.listing_id, (counts.get(b.listing_id) ?? 0) + 1);
      if (companyId && b.company_id === companyId && b.status !== 'withdrawn') mine.add(b.listing_id);
    });
  }

  return (
    <>
      <div className="stack">
        <h1>{isPro ? 'Projects near you' : 'Your marketplace projects'}</h1>
        <p className="muted">{isPro ? 'Real jobs from homeowners, waiting for bids.' : 'Post a job, compare bids from local contractors, and hire who you choose.'}</p>
      </div>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      {isPro ? (
        <>
          <div className="row">
            <Link className="btn ghost" href="/marketplace/bids">My bids</Link>
          </div>
          <div className="chips" aria-label="Filter by job type">
            <Link className="chip" href="/marketplace"><span style={!type ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>All</span></Link>
            {Object.keys(JOB_TYPES).map((t) => (
              <Link className="chip" key={t} href={`/marketplace?type=${encodeURIComponent(t)}`}><span style={type === t ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>{t}</span></Link>
            ))}
          </div>
        </>
      ) : (
        <div className="row"><Link className="btn" href="/marketplace/new">Post a project</Link></div>
      )}

      {listings.length === 0 && (
        <div className="card"><p className="muted">{isPro ? 'No open projects right now. Check back soon.' : 'You have not posted a project yet.'}</p></div>
      )}

      {listings.map((l) => {
        const open = listingOpen(l);
        const status = l.status === 'awarded' ? 'Hired' : !open ? 'Closed' : 'Open';
        return (
          <Link key={l.id} href={`/marketplace/${l.id}`} className="card" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="pill">{l.job_type}</span>
              <span className={`pill ${open ? 'ok' : ''}`}>{status}</span>
            </div>
            <h3>{listingTitle(l)}</h3>
            <p className="muted small">{[l.city, `ZIP ${l.zip}`, l.size_sqft ? `${l.size_sqft.toLocaleString('en-US')} sq ft` : ''].filter(Boolean).join(' · ')}</p>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{budget(l) || 'Budget not shared'}</b>
              <span className="muted small">
                {counts.get(l.id) ?? 0} bid{(counts.get(l.id) ?? 0) === 1 ? '' : 's'}
                {isPro ? ` · by ${firstNameInitial(l.homeowner_name)}` : ''} · {when(l.created_at)}
                {mine.has(l.id) ? ' · You bid' : ''}
              </span>
            </div>
          </Link>
        );
      })}
    </>
  );
}
