'use client';

import { useEffect, useState } from 'react';

/** What the Get the app menu row should do on this device. `installed` hides the row entirely; `nudge` adds the green highlight (phone, not installed, alerts not allowed). */
export function useGetApp(): { installed: boolean; nudge: boolean } {
  const [s, setS] = useState({ installed: false, nudge: false });
  useEffect(() => {
    try {
      const installed = !!((navigator as unknown as { standalone?: boolean }).standalone || window.matchMedia('(display-mode: standalone)').matches);
      const phone = /iphone|ipad|android/i.test(navigator.userAgent);
      const alerts = 'Notification' in window && Notification.permission === 'granted';
      setS({ installed, nudge: phone && !installed && !alerts });
    } catch { setS({ installed: false, nudge: false }); }
  }, []);
  return s;
}
