import Link from 'next/link';
import type { MeterItem } from '@/lib/profileMeter';

/** Contractor Projects page: shows until the profile is 100% complete. */
export default function ProfileMeter({ pct, items }: { pct: number; items: MeterItem[] }) {
  if (pct >= 100) return null;
  return (
    <div className="card" style={{ background: 'var(--accent-soft, #f9efe4)', gap: 10 }}>
      <h2 style={{ margin: 0 }}>Your profile is {pct}% done</h2>
      <div style={{ height: 10, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 99 }} />
      </div>
      <p className="muted small" style={{ margin: 0 }}>Complete profiles get picked more often. Homeowners compare profiles before they choose.</p>
      <div>
        {items.map((i) => (
          <div key={i.label} className="row" style={{ flexWrap: 'nowrap', gap: 10, padding: '9px 0', borderTop: '1px solid var(--line)' }}>
            <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, border: '1.5px solid var(--line)', background: i.ok ? 'var(--ok)' : 'transparent', borderColor: i.ok ? 'var(--ok)' : 'var(--line)', color: '#fff' }}>{i.ok ? '✓' : ''}</span>
            <b style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{i.label}</b>
            {i.ok ? null : <Link href="/settings/business" style={{ fontWeight: 700, fontSize: 14 }}>{i.cta}</Link>}
          </div>
        ))}
      </div>
    </div>
  );
}
