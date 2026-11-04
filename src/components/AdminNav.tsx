'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavGroup = { key: string; label: string; badge: number; links: { href: string; label: string; badge: number }[] };

const isOn = (path: string, href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'));

/** Admin navigation: a row of groups, and the links of the open group underneath. The current page is highlighted. */
export default function AdminNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname() ?? '';
  const current = groups.find((g) => g.links.some((l) => isOn(path, l.href))) ?? groups[0];
  if (!current) return null;
  const dot: React.CSSProperties = { background: 'var(--bad)', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '1px 6px', marginLeft: 6 };
  return (
    <nav aria-label="Admin" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${groups.length}, 1fr)`, gap: 6, background: 'var(--line)', borderRadius: 18, padding: 4 }}>
        {groups.map((g) => {
          const on = g.key === current.key;
          return (
            <Link
              key={g.key}
              href={g.links[0].href}
              aria-current={on ? 'true' : undefined}
              style={{ position: 'relative', minHeight: 48, display: 'grid', placeItems: 'center', borderRadius: 14, fontSize: 12.5, fontWeight: 700, textAlign: 'center', padding: '4px 2px', textDecoration: 'none', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-2)', boxShadow: on ? '0 1px 4px rgba(0,0,0,.15)' : 'none' }}
            >
              {g.label}
              {g.badge > 0 ? <span style={{ ...dot, position: 'absolute', top: 4, right: 4, margin: 0 }}>{g.badge}</span> : null}
            </Link>
          );
        })}
      </div>
      {current.links.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {current.links.map((l) => {
            const on = isOn(path, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? 'page' : undefined}
                className="btn ghost"
                style={{ minHeight: 40, padding: '6px 14px', whiteSpace: 'nowrap', background: on ? 'var(--ink)' : undefined, color: on ? 'var(--bg)' : undefined, borderColor: on ? 'var(--ink)' : undefined }}
              >
                {l.label}
                {l.badge > 0 ? <span style={dot}>{l.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
