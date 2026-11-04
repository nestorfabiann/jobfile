'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Bottom tab bar for signed-out visitors. */
export default function PubTabs() {
  const p = usePathname() || '/';
  const tabs = [
    { href: '/', icon: 'M3 11l9-8 9 8M5 10v10h14V10', label: 'Home', on: p === '/' },
    { href: '/jobs', icon: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5', label: 'Open jobs', on: p.startsWith('/jobs') },
    { href: '/login', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6', label: 'Sign in', on: p.startsWith('/login') },
  ];
  return (
    <nav className="pubtabs" aria-label="Main">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.on ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.icon} /></svg>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
