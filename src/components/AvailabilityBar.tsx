import AvailabilityForm from '@/components/AvailabilityForm';
import { availabilityOf, untilText } from '@/lib/availability';

/** A slim status bar on the contractor's Projects page. Tap Change to switch. */
export default function AvailabilityBar({ company }: { company: { availability?: string | null; booked_until?: string | null } }) {
  const a = availabilityOf(company);
  const label = a.mode === 'open' ? 'Taking new jobs' : a.mode === 'paused' ? 'Paused, hidden from Find contractors' : `Booked until ${untilText(a.until!)}`;
  const color = a.mode === 'open' ? 'var(--ok)' : 'var(--warn)';
  const soon = a.mode === 'booked' && a.daysLeft != null && a.daysLeft <= 7;
  return (
    <details className="card" style={{ padding: 0 }}>
      <summary className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', padding: '10px 12px 10px 16px', cursor: 'pointer', listStyle: 'none', gap: 10 }}>
        <span style={{ minWidth: 0 }}>
          <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 8 }} />
          <b>{label}</b>
          {soon ? <span className="muted small" style={{ display: 'block' }}>Ends in {a.daysLeft} day{a.daysLeft === 1 ? '' : 's'}. Change it if you are not ready.</span> : null}
        </span>
        <span className="pill" style={{ flex: 'none' }}>Change</span>
      </summary>
      <div style={{ padding: '4px 16px 16px' }}>
        <AvailabilityForm company={company} back="/projects" />
      </div>
    </details>
  );
}
