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
    <section className="hsc" aria-label="Add to Home Screen">
      <div className="hsc-top">
        <img src="/icons/icon-192.png" alt="" width={56} height={56} />
        <div><b>Keep Jobfile on your Home Screen</b><span>Opens full screen. Takes 10 seconds.</span></div>
      </div>
      <div className="hsc-row">
        <Link className="hsc-go" href="/app" onClick={hide}>Show me how</Link>
        <button type="button" onClick={hide}>Not now</button>
      </div>
    </section>
  );
}
