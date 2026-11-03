import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { health } from '@/lib/adminHealth';
import { listingTitle } from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

const hrs = (h: number | null) => (h == null ? 'none yet' : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} hrs` : `${Math.round(h / 24)} days`);

export default async function Health({ searchParams }: { searchParams: { r?: string } }) {
  const { db } = await requireAdmin();
  const r = searchParams.r === '30' ? 30 : searchParams.r === 'all' ? null : 7;
  const h = await health(db, r);
  const pct = (n: number) => (h.posted ? Math.round((n / h.posted) * 100) : 0);
  const rows: [string, number][] = [['Posted a project', h.posted], ['Got at least one bid', h.withBid], ['Hired a contractor', h.hired]];
  const opts: [string, string][] = [['7', '7 days'], ['30', '30 days'], ['all', 'All time']];
  const cur = r === null ? 'all' : String(r);
  return (
    <>
      <h1>Marketplace health</h1>
      <div className="row" aria-label="Period">
        {opts.map(([k, l]) => <Link key={k} href={`/admin/health?r=${k}`} className={`btn ${cur === k ? '' : 'ghost'}`} style={{ minHeight: 40 }}>{l}</Link>)}
      </div>
      <div className="card">
        <h2>From posted to hired</h2>
        {rows.map(([l, n]) => (
          <div key={l}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><span>{l}</span><b>{n} <span className="muted small" style={{ fontWeight: 400 }}>({pct(n)}%)</span></b></div>
            <div className="bar" role="img" aria-label={`${pct(n)}%`}><span style={{ width: `${pct(n)}%` }} /></div>
          </div>
        ))}
        <p className="muted small" style={{ margin: 0 }}>{h.noBid} of {h.posted} projects have not had a bid. {h.withBid - h.hired} got bids but no one has been hired yet.</p>
      </div>
      <div className="tiles">
        <div className="tile"><span className="small muted">Time to first bid</span><b>{hrs(h.avgFirstBidHrs)}</b></div>
        <div className="tile"><span className="small muted">Bids per project</span><b>{h.bidsPerProject.toFixed(1)}</b></div>
        <div className="tile"><span className="small muted">Projects with no bids</span><b>{h.noBid}</b></div>
        <div className="tile"><span className="small muted">Bids accepted</span><b>{h.bidsAccepted}</b></div>
      </div>
      <div className="card">
        <h2>Open with no bids yet</h2>
        {h.waiting.length === 0 ? <p className="muted">Every open project in this period has a bid.</p> : h.waiting.map(({ listing: l, coverage }) => (
          <div key={l.id} className="card" style={{ gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><b>{listingTitle(l)}</b><span className="pill">{Math.max(0, Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000))} days</span></div>
            <span className="muted small">ZIP {l.zip} · {coverage == null ? 'coverage unknown' : `${coverage} contractor${coverage === 1 ? '' : 's'} cover ${l.job_type.toLowerCase()} here`}</span>
          </div>
        ))}
        <p className="muted small" style={{ margin: 0 }}>Longest waiting first. The coverage line counts registered contractors who list that trade and whose service area reaches that ZIP, so you can see whether the wait is a supply gap.</p>
      </div>
    </>
  );
}
