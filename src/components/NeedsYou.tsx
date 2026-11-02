import Link from 'next/link';

export type NeedItem = { key: string; title: string; sub: string; href: string; go: string; tone: 'new' | 'won' };

/** Things waiting on this person. Disappears when there is nothing to do. */
export default function NeedsYou({ items }: { items: NeedItem[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="Needs you" className="card" style={{ background: 'var(--accent-soft, #f9efe4)', borderColor: 'var(--line)', gap: 8 }}>
      <h2 style={{ fontSize: 20 }}>Needs you <span style={{ color: 'var(--accent)' }}>{items.length}</span></h2>
      {items.map((i) => (
        <Link key={i.key} href={i.href} prefetch={false} className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 56, textDecoration: 'none', color: 'var(--ink)' }}>
          <span aria-hidden="true" style={{ flex: 'none', width: 10, height: 10, borderRadius: '50%', background: i.tone === 'won' ? 'var(--ok)' : 'var(--accent)' }} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <b style={{ display: 'block', fontSize: 14.5 }}>{i.title}</b>
            <span className="muted small" style={{ display: 'block', textDecoration: 'none' }}>{i.sub}</span>
          </span>
          <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', textDecoration: 'none' }}>{i.go} ›</span>
        </Link>
      ))}
    </section>
  );
}
