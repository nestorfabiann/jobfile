'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import MenuIcon from '@/components/MenuIcon';
import { useGetApp } from '@/lib/useGetApp';
import { useCollab } from '@/lib/useCollab';
import { useIsNew } from '@/lib/useSeen';

/** Signed-in header menu: Home first, then the usual links. Closes on navigation, outside tap and Escape. */
export default function AppMenu({ marketplace, contractor, admin, invites = 0, community = 0, design = false, signOutAction }: { marketplace: boolean; design?: boolean; contractor?: boolean; admin: boolean; invites?: number; community?: number; signOutAction: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const { installed, nudge: getApp } = useGetApp();
  const collab = useCollab(invites);
  const commNew = useIsNew('jf-community-seen', '/community');
  const designNew = useIsNew('jf-design-seen', '/design');

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
    ...(marketplace ? ([['/community', 'Community', 'comm']] as [string, string, string][]) : []),
    ...(marketplace && contractor ? ([['/collaborate', 'Collaborate', 'collab']] as [string, string, string][]) : []),
    ...(marketplace && !contractor ? ([['/find', 'Find contractors', 'find']] as [string, string, string][]) : []),
    ...(marketplace && design && !contractor ? ([['/design', 'Design ideas', 'design']] as [string, string, string][]) : []),
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
          {items.filter(([href]) => !(href === '/app' && installed)).map(([href, label, icon]) => (
            <Link key={href} href={href} className={(href === '/app' && getApp) || (href === '/collaborate' && collab.highlight) ? 'mi-new' : undefined} aria-current={current(href) ? 'page' : undefined}><MenuIcon name={icon} tile />{href === '/app' ? <span>{label}<small className="mi-sub">Alerts on your phone</small></span> : href === '/collaborate' ? <span>{label}<small className="mi-sub">Team up on bids</small></span> : label}{href === '/app' && getApp ? <span className="mi-tag">New</span> : null}{href === '/collaborate' && collab.tag ? <span className="mi-tag">{collab.tag}</span> : null}{href === '/community' && community > 0 ? <span className="mi-count" aria-label={`${community} unread`}>{community}</span> : href === '/community' && commNew ? <span className="mi-tag">New</span> : href === '/design' && designNew ? <span className="mi-tag">New</span> : null}</Link>
          ))}
          <hr />
          <form action={signOutAction}><button type="submit" className="menu-out"><MenuIcon name="out" tile />Sign out</button></form>
        </nav>
      )}
    </div>
  );
}
