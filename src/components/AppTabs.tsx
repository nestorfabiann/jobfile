'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import MenuIcon from '@/components/MenuIcon';

const IC: Record<string, string> = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  proj: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 13h6M10 17h6"/>',
  post: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  find: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};

/** Bottom tab bar for signed-in people. Homeowners get Post, contractors get Find work. */
export default function AppTabs({ contractor, marketplace, waiting, admin, signOutAction }: { contractor: boolean; marketplace: boolean; waiting: number; admin: boolean; signOutAction: () => void | Promise<void> }) {
  const path = usePathname() || '/';
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open]);

  const tabs: { href?: string; icon: string; label: string; on: boolean; badge?: number }[] = [
    { href: '/', icon: 'home', label: 'Home', on: path === '/' },
    { href: '/projects', icon: 'proj', label: 'Projects', on: path.startsWith('/projects') || path.startsWith('/invites'), badge: waiting },
    ...(marketplace
      ? [contractor
          ? { href: '/marketplace', icon: 'find', label: 'Find work', on: path === '/marketplace' || (path.startsWith('/marketplace/') && !path.startsWith('/marketplace/new')) }
          : { href: '/marketplace/new', icon: 'post', label: 'Post', on: path.startsWith('/marketplace/new') }]
      : []),
    { icon: 'menu', label: 'Menu', on: open },
  ];
  const links: [string, string, string][] = [
    ...(marketplace ? ([['/marketplace', 'Marketplace', 'mkt']] as [string, string, string][]) : []),
    ...(marketplace && !contractor ? ([['/find', 'Find contractors', 'find']] as [string, string, string][]) : []),
    ['/settings', 'Settings', 'set'],
    ['/invite', 'Invite friends', 'inv'],
    ['/help', 'Help and contact', 'help'],
    ...(contractor ? ([['/settings/business', 'Business profile', 'biz']] as [string, string, string][]) : []),
    ...(admin ? ([['/admin', 'Admin', 'adm']] as [string, string, string][]) : []),
  ];

  return (
    <>
      {open && <div className="apptabs-shade" onClick={() => setOpen(false)} aria-hidden="true" />}
      {open && (
        <nav className="apptabs-sheet" id="apptabs-sheet" aria-label="More">
          {links.map(([h, l, i]) => <Link key={h} href={h}><MenuIcon name={i} />{l}</Link>)}
          <form action={signOutAction}><button type="submit"><MenuIcon name="out" />Sign out</button></form>
        </nav>
      )}
      <nav className="apptabs" aria-label="Main">
        <div className="apptabs-in" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((t) => {
            const inner = (
              <>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: IC[t.icon] }} />
                {t.label}
                {t.badge ? <span className="apptabs-dot" aria-label={`${t.badge} waiting`}>{t.badge > 9 ? '9+' : t.badge}</span> : null}
              </>
            );
            return t.href ? (
              <Link key={t.label} href={t.href} className={`apptab${t.on ? ' on' : ''}`} aria-current={t.on ? 'page' : undefined}>{inner}</Link>
            ) : (
              <button key={t.label} type="button" className={`apptab${t.on ? ' on' : ''}`} aria-expanded={open} aria-controls="apptabs-sheet" onClick={() => setOpen((o) => !o)}>{inner}</button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
