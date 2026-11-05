'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/** True until the person has opened a section once. Remembered in this browser only. */
export function useIsNew(key: string, prefix: string): boolean {
  const path = usePathname() || '/';
  const [isNew, setNew] = useState(false);
  useEffect(() => {
    try {
      if (path.startsWith(prefix)) { localStorage.setItem(key, '1'); setNew(false); }
      else setNew(localStorage.getItem(key) !== '1');
    } catch { setNew(false); }
  }, [path, key, prefix]);
  return isNew;
}
