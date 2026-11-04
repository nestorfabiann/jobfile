'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import MenuIcon from '@/components/MenuIcon';

/** Signed-in header menu: Home first, then the usual links. Closes on navigation, outside tap and Escape. */
export default function AppMenu({ marketplace, contractor, admin, signOutAction }: { marketplace: boolean; contractor?: boolean; admin: boolean; signOutAction: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const items: [string, string, string][] = [
    ['/', 'Home', 'home'],
    ['/projects', 'Projects', 'proj'],
    ...(marketplace ? ([['/marketplace', 'Marketplace', 'mkt']] as [string, string, string][]) : []),
    ...(marketplace && !contractor ? ([['/find', 'Find contractors', 'find']] as [string, string, string][]) : []),
    ['/settings', 'Settings', 'set'],
    ...(contractor ? ([['/settings/business', 'Business profile', 'biz']] as [string, string, string][]) : []),
    ['/invite', 'Invite friends', 'inv'],
    ['/app', 'Get the app', 'app'],
    ['/help', 'Help and contact', 'help'],
    ...(admin ? ([['/admin', 'Admin', 'adm']] as [string, string, string][]) : []),
  ];
  const current = (href: string) => {
    if (href === '/') return path === '/';
    if (href === '/settings' && path.startsWith('/settings/business')) return false; // Business profile has its own row
    return path === href || path.startsWith(`${href}/`);
  };

  return (
    <div className="appmenu" ref={box}>
      <button type="button" className="appmenu-btn" aria-expanded={open} aria-controls="appmenu-sheet" onClick={() => setOpen((o) => !o)}>
        Menu <span aria-hidden="true">☰</span>
      </button>
      {open && (
        <nav id="appmenu-sheet" className="appmenu-sheet" aria-label="Main">
          {items.map(([href, label, icon]) => (
            <Link key={href} href={href} aria-current={current(href) ? 'page' : undefined}><MenuIcon name={icon} />{href === '/app' ? <span>{label}<small className="mi-sub">Alerts on your phone</small></span> : label}</Link>
          ))}
          <hr />
          <form action={signOutAction}><button type="submit" className="menu-out"><MenuIcon name="out" />Sign out</button></form>
        </nav>
      )}
    </div>
  );
}
