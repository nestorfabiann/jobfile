'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ProjectTabs({ id }: { id: string }) {
  const path = usePathname();
  const base = `/projects/${id}`;
  const tabs = [
    [base, 'Messages'],
    [`${base}/agreement`, 'Agreement'],
    [`${base}/changes`, 'Changes'],
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
