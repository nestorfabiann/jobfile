'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Bottom tab bar for signed-out visitors. */
export default function PubTabs() {
  const p = usePathname() || '/';
  const tabs = [
    { href: '/', icon: '🏠', label: 'Home', on: p === '/' },
    { href: '/jobs', icon: '🔨', label: 'Open jobs', on: p.startsWith('/jobs') },
    { href: '/login', icon: '🔑', label: 'Sign in', on: p.startsWith('/login') },
  ];
  return (
    <nav className="pubtabs" aria-label="Main">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.on ? 'page' : undefined}>
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
