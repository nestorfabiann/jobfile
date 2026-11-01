'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ProjectTabs({ id, priceCheck = false }: { id: string; priceCheck?: boolean }) {
  const path = usePathname();
  const base = `/projects/${id}`;
  const tabs = [
    [`${base}/overview`, 'Overview'],
    [base, 'Messages'],
    [`${base}/agreement`, 'Agreement'],
    [`${base}/photos`, 'Photos'],
    [`${base}/changes`, 'Changes'],
    [`${base}/payments`, 'Payments'],
    ...(priceCheck ? [[`${base}/price-check`, 'Price check']] : []),
  ];
  return (
    <nav className="ptabs" aria-label="Project sections">
      {tabs.map(([href, label]) => {
        const active = href === base ? path === base : path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
