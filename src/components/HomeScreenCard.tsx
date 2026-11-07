'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'jf-home-card';

/** One-time card suggesting the Home Screen, for phone users who are not already using it that way. */
export default function HomeScreenCard() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const standalone = (navigator as unknown as { standalone?: boolean }).standalone || window.matchMedia('(display-mode: standalone)').matches;
      const phone = /iphone|ipad|android/i.test(navigator.userAgent);
      if (phone && !standalone && !localStorage.getItem(KEY)) setShow(true);
    } catch { /* leave hidden */ }
  }, []);
  if (!show) return null;
  const hide = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setShow(false); };
  return (
    <section aria-label="Get the app" className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
      <img src="/icons/icon-192.png" alt="" width={26} height={26} style={{ borderRadius: 8, flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}><b>Jobfile on your phone</b></span>
      <Link href="/app" onClick={hide} style={{ fontWeight: 700, fontSize: 13 }}>Add</Link>
      <button type="button" onClick={hide} aria-label="Not now" style={{ background: 'none', border: 0, fontSize: 18, lineHeight: 1, color: 'var(--ink-2, #6b655e)', cursor: 'pointer', padding: '0 4px' }}>&times;</button>
    </section>
  );
}
