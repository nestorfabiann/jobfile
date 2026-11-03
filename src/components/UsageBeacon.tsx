'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** Sends a tiny page-view note when the page changes, and a "still here" note once a minute while the tab is visible. */
export default function UsageBeacon() {
  const path = usePathname() || '/';
  const latest = useRef(path);
  latest.current = path;

  const send = (kind: 'view' | 'ping') => {
    try {
      void fetch('/api/usage', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, path: latest.current }) });
    } catch { /* ignore */ }
  };

  useEffect(() => { send('view'); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') send('ping'); }, 60_000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
