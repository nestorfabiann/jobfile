import Link from 'next/link';

const STEPS = ['Posted', 'Bids coming in', 'Compare', 'Hire', 'Start'];

/** Where a homeowner's project is, and the one thing to do next. `now` is the index of the current step. */
export default function ProgressStrip({ now, title, text, action }: { now: number; title: string; text: string; action?: { href: string; label: string } }) {
  return (
    <section aria-label="Progress" className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ol style={{ display: 'flex', alignItems: 'flex-start', margin: 0, padding: '14px 8px', listStyle: 'none', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22 }}>
        {STEPS.map((s, i) => {
          const done = i < now;
          const cur = i === now;
          return (
            <li key={s} aria-current={cur ? 'step' : undefined} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', fontSize: 11.5, lineHeight: 1.25, position: 'relative', color: cur ? 'var(--ink)' : 'var(--muted, #6b655e)', fontWeight: cur ? 700 : 500 }}>
              {i < STEPS.length - 1 && <span aria-hidden="true" style={{ position: 'absolute', top: 12, left: '50%', width: '100%', height: 2, background: done ? 'var(--ok)' : 'var(--line)' }} />}
              <span aria-hidden="true" style={{ position: 'relative', zIndex: 1, width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, border: `2px solid ${done ? 'var(--ok)' : cur ? 'var(--accent)' : 'var(--line)'}`, background: done ? 'var(--ok)' : cur ? 'var(--accent)' : 'var(--bg, #faf8f4)', color: done || cur ? '#fff' : 'var(--muted, #6b655e)' }}>{done ? '✓' : i + 1}</span>
              {s}
            </li>
          );
        })}
      </ol>
      <div className="box warn" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <b>{title}</b>
        <span>{text}</span>
        {action && <Link className="btn" href={action.href} style={{ marginTop: 2 }}>{action.label}</Link>}
      </div>
    </section>
  );
}
