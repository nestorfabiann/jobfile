'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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

  const items: [string, string][] = [
    ['/', 'Home'],
    ['/projects', 'Projects'],
    ...(marketplace ? ([['/marketplace', 'Marketplace']] as [string, string][]) : []),
    ...(marketplace && !contractor ? ([['/find', 'Find contractors']] as [string, string][]) : []),
    ['/settings', 'Settings'],
    ['/invite', 'Invite friends'],
    ['/help', 'Help and contact'],
    ...(admin ? ([['/admin', 'Admin']] as [string, string][]) : []),
  ];
  const current = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

  return (
    <div className="appmenu" ref={box}>
      <button type="button" className="appmenu-btn" aria-expanded={open} aria-controls="appmenu-sheet" onClick={() => setOpen((o) => !o)}>
        Menu <span aria-hidden="true">☰</span>
      </button>
      {open && (
        <nav id="appmenu-sheet" className="appmenu-sheet" aria-label="Main">
          {items.map(([href, label]) => (
            <Link key={href} href={href} aria-current={current(href) ? 'page' : undefined}>{label}</Link>
          ))}
          <hr />
          <form action={signOutAction}><button type="submit">Sign out</button></form>
        </nav>
      )}
    </div>
  );
}
