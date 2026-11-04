'use client';

import { useEffect, useState } from 'react';

/** True on a phone that is not yet using the Home Screen app and has not allowed alerts. Drives the highlight on the Get the app menu row. */
export function useGetApp(): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const standalone = (navigator as unknown as { standalone?: boolean }).standalone || window.matchMedia('(display-mode: standalone)').matches;
      const phone = /iphone|ipad|android/i.test(navigator.userAgent);
      const alerts = 'Notification' in window && Notification.permission === 'granted';
      setShow(phone && !standalone && !alerts);
    } catch { setShow(false); }
  }, []);
  return show;
}
