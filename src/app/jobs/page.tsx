import Link from 'next/link';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { publicListings } from '@/lib/publicMarketplace';
import PublicJobCard from '@/components/PublicJobCard';

export const dynamic = 'force-dynamic';

export default async function OpenJobs({ searchParams }: { searchParams: { type?: string } }) {
  requireMarketplace();
  const type = searchParams.type && JOB_TYPES[searchParams.type] ? searchParams.type : '';
  const { listings, counts } = await publicListings(type, 60);
  const on = { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } as const;
  return (
    <>
      <div className="stack">
        <span className="lbl">Open to everyone</span>
        <h1>Projects near you</h1>
        <p className="muted">Real jobs from homeowners, waiting for bids. Sign in to bid or to post your own.</p>
      </div>
      <div className="chips" aria-label="Filter by job type">
        <Link className="chip" href="/jobs"><span style={!type ? on : undefined}>All</span></Link>
        {Object.keys(JOB_TYPES).map((t) => (
          <Link className="chip" key={t} href={`/jobs?type=${encodeURIComponent(t)}`}><span style={type === t ? on : undefined}>{t}</span></Link>
        ))}
      </div>
      {listings.length === 0 && <div className="card"><p className="muted">No open projects{type ? ` in ${type}` : ''} right now. Check back soon.</p></div>}
      {listings.map((l) => <PublicJobCard key={l.id} l={l} bids={counts.get(l.id) ?? 0} />)}
      <div className="box warn">Street addresses, homeowner names and phone numbers stay private. Only the city and ZIP show until a homeowner accepts a bid.</div>
    </>
  );
}
