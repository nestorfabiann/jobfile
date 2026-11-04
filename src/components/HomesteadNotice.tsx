'use client';

import { usePathname } from 'next/navigation';

/** The Texas homestead notice, shown only where it matters: Overview and Agreement. */
export default function HomesteadNotice({ id }: { id: string }) {
  const path = usePathname();
  const base = `/projects/${id}`;
  if (!(path === `${base}/overview` || path.startsWith(`${base}/overview/`) || path === `${base}/agreement` || path.startsWith(`${base}/agreement/`))) return null;
  return (
    <details className="box warn">
      <summary style={{ cursor: 'pointer' }}><b>Homestead job.</b> Texas has extra contract rules. Tap to read them.</summary>
      <p style={{ margin: '8px 0 0' }}>
        Texas requires a written contract, signed by both spouses if the owner is married, before work or materials start, and
        filed with the county clerk. Track these steps on the Agreement tab. Have a Texas construction attorney review your contract.
      </p>
    </details>
  );
}
