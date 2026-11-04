import { requireAdmin } from '@/lib/admin';
import { marketplaceEnabled, listingTitle, type Listing } from '@/lib/marketplace';
import { adminCloseListing } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminMarketplace() {
  const { db } = await requireAdmin('listings');
  const { data } = await db.from('marketplace_listings').select('*').order('created_at', { ascending: false }).limit(100);
  const listings = (data ?? []) as Listing[];
  const ids = listings.map((l) => l.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: bids } = await db.from('marketplace_bids').select('listing_id').in('listing_id', ids);
    (bids ?? []).forEach((b: any) => counts.set(b.listing_id, (counts.get(b.listing_id) ?? 0) + 1));
  }
  return (
    <>
      <h1>Marketplace</h1>
      <p className="muted small">The marketplace is {marketplaceEnabled() ? 'ON' : 'OFF'} (MARKETPLACE_ENABLED). Close a project only for rule violations. Every close is written to the audit log and the people involved are told.</p>
      {listings.length === 0 && <div className="card"><p className="muted">No projects posted yet.</p></div>}
      {listings.map((l) => (
        <div className="card" key={l.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{listingTitle(l)}</b>
            <span className={`pill ${l.status === 'open' ? 'ok' : ''}`}>{l.status}</span>
          </div>
          <p className="muted small">{[l.city, `ZIP ${l.zip}`, `${counts.get(l.id) ?? 0} bids`, new Date(l.created_at).toLocaleDateString('en-US')].filter(Boolean).join(' · ')}</p>
          {l.details ? <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{l.details}</p> : null}
          {l.status === 'open' && (
            <form action={adminCloseListing} className="row">
              <input type="hidden" name="listing_id" value={l.id} />
              <input name="reason" placeholder="Reason (saved in the audit log)" required style={{ flex: 1, minWidth: 200 }} />
              <button className="btn ghost" type="submit">Close project</button>
            </form>
          )}
        </div>
      ))}
    </>
  );
}
