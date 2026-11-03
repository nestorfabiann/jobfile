import Link from 'next/link';
import { ageOf, type NeedIcon, type NeedItem } from '@/lib/needs';

const ICONS: Record<NeedIcon, JSX.Element> = {
  done: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>,
  sign: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  co: <><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4" /><path d="M10 13h6" /><path d="M10 17h6" /></>,
  pay: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  bid: <><path d="M3 12l9-8 9 8" /><path d="M6 10v10h12V10" /></>,
  msg: <path d="M4 5h16v11H9l-5 4z" />,
  star: <path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.3l6-.7z" />,
  job: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></>,
};

/** Open tasks for this person, oldest first. Disappears when there is nothing to do, or shows a short all-caught-up line. */
export default function NeedsYou({ items, caughtUp }: { items: NeedItem[]; caughtUp?: boolean }) {
  if (!items.length) {
    return caughtUp ? (
      <section aria-label="Needs you" className="card" style={{ background: 'var(--ok-soft, #d9f1e6)', borderColor: 'transparent', padding: 14, gap: 2 }}>
        <b style={{ color: 'var(--ok)' }}>You&rsquo;re all caught up</b>
        <span className="muted small">Nothing is waiting on you right now.</span>
      </section>
    ) : null;
  }
  return (
    <section aria-label="Needs you" className="card" style={{ background: 'var(--accent-soft, #f9efe4)', borderColor: 'var(--line)', gap: 8 }}>
      <h2 style={{ fontSize: 20 }}>Needs you <span style={{ color: 'var(--accent)' }}>{items.length}</span></h2>
      <p className="muted small" style={{ margin: 0 }}>Oldest first. Each one leaves this list when it is done.</p>
      {items.map((i) => {
        const age = ageOf(i.at);
        return (
          <Link key={i.key} href={i.href} prefetch={false} className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 56, textDecoration: 'none', color: 'var(--ink)' }}>
            <span aria-hidden="true" style={{ flex: 'none', width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'var(--accent-soft, #f9efe4)', color: 'var(--accent)' }}>
              <svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{ICONS[i.icon]}</svg>
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <b style={{ display: 'block', fontSize: 14.5, lineHeight: 1.3 }}>{i.title}</b>
              <span className="muted small" style={{ display: 'block' }}>{i.sub}</span>
              <span className="small" style={{ display: 'inline-block', marginTop: 4, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: age.late ? 'var(--bad-soft, #fbe4e2)' : 'var(--accent-soft, #f9efe4)', color: age.late ? 'var(--bad)' : 'var(--accent)' }}>{age.label}</span>
            </span>
            <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{i.go} ›</span>
          </Link>
        );
      })}
    </section>
  );
}
