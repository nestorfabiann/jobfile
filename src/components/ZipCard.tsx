import Link from 'next/link';
import { saveZip, skipZip } from '@/app/projects/zipActions';
import type { NearbyContractor } from '@/lib/nearby';

/** Homeowners without a ZIP are asked once per sign-in. With a ZIP, the card shows the nearest contractors. */
export default function ZipCard({ zip, error, near }: { zip: string | null; error?: string; near: { total: number; top: NearbyContractor[] } | null }) {
  if (!zip) {
    return (
      <div className="card" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
        <h2>What&apos;s your ZIP code?</h2>
        <p className="muted small">We&apos;ll show you contractors near you and tell you when new ones join your area.</p>
        {error ? <div className="box bad">{error}</div> : null}
        <form action={saveZip} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input name="zip" inputMode="numeric" maxLength={5} pattern="[0-9]{5}" placeholder="75074" autoComplete="postal-code" required style={{ fontSize: 20, fontWeight: 700 }} aria-label="ZIP code" />
          <button className="btn" type="submit">Save ZIP</button>
        </form>
        <form action={skipZip}><button type="submit" className="small" style={{ background: 'none', border: 0, textDecoration: 'underline', color: 'var(--muted)', minHeight: 44, width: '100%' }}>Skip for now</button></form>
      </div>
    );
  }
  if (!near || near.total === 0) return null;
  return (
    <div className="card">
      <h2>Contractors near {zip}</h2>
      <p className="muted small">{near.total} on Jobfile within 50 miles.</p>
      {near.top.map((c) => (
        <div key={c.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <Link href={`/contractors/${c.id}`}><b>{c.name}</b></Link>
          <span className="muted small">{c.miles} mi</span>
        </div>
      ))}
    </div>
  );
}
