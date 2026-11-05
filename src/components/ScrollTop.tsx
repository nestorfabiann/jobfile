'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Next.js scrolls to the top of the page segment when you move between project tabs, which leaves the project
 * name and tabs above the screen. This puts the page back at the very top after each tab change, so the tabs
 * are always in view. Links to a section (#something) are left alone.
 */
export default function ScrollTop() {
  const path = usePathname();
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash) return;
    const go = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    go();
    // Next.js does its own scroll right after this effect, so go to the top once more after it.
    const raf = requestAnimationFrame(() => requestAnimationFrame(go));
    const t = setTimeout(go, 120);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [path]);
  return null;
}
