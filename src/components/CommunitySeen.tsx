'use client';

import { useEffect } from 'react';

/** Remembers when this person last looked at Community, so the next visit can highlight what is new. Cookies only; nothing leaves the browser except with the page request. */
export default function CommunitySeen({ since }: { since: number }) {
  useEffect(() => {
    try {
      const exp = '; max-age=31536000; path=/; samesite=lax';
      document.cookie = `cm_seen=${since}${exp}`;
      document.cookie = `cm_active=${Date.now()}${exp}`;
    } catch { /* cookies blocked */ }
  }, [since]);
  return null;
}
