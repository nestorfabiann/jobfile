'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Re-fetches the page data on a timer so new messages appear without a manual reload.
 * It never interrupts typing or a picker, and it puts the page back where the person was if the refresh moves it.
 */
export default function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    let touched = 0;
    const mark = () => { touched = Date.now(); };
    window.addEventListener('touchstart', mark, { passive: true });
    window.addEventListener('wheel', mark, { passive: true });
    window.addEventListener('keydown', mark);
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const a = document.activeElement as HTMLElement | null;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return; // someone is typing or choosing
      if (Date.now() - touched < 4000) return; // they are scrolling right now
      const y = window.scrollY;
      const started = Date.now();
      router.refresh();
      [80, 300, 800, 1500].forEach((ms) => setTimeout(() => {
        if (touched > started) return; // they moved on their own, leave it
        if (window.scrollY < y - 4) window.scrollTo(0, y);
      }, ms));
    }, seconds * 1000);
    return () => {
      clearInterval(t);
      window.removeEventListener('touchstart', mark);
      window.removeEventListener('wheel', mark);
      window.removeEventListener('keydown', mark);
    };
  }, [router, seconds]);
  return null;
}
