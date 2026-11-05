'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/** The Collaborate row is highlighted green until the person has opened the page once, or while invites are waiting. */
export function useCollab(invites: number): { highlight: boolean; tag: string } {
  const path = usePathname() || '/';
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    try {
      if (path.startsWith('/collaborate')) { localStorage.setItem('jf-collab-seen', '1'); setSeen(true); }
      else setSeen(localStorage.getItem('jf-collab-seen') === '1');
    } catch { setSeen(true); }
  }, [path]);
  const waiting = invites > 0;
  return { highlight: waiting || !seen, tag: waiting ? String(invites) : !seen ? 'New' : '' };
}
