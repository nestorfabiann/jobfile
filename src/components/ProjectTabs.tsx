'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICONS: Record<string, JSX.Element> = {
  Overview: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  Messages: <path d="M4 5h16v11H9l-5 4z" />,
  Agreement: <><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4" /><path d="M10 13h6M10 17h6" /></>,
  Photos: <><rect x="3" y="6" width="18" height="14" rx="3" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></>,
  Schedule: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  Selections: <><path d="M5 6h14M5 12h14M5 18h9" /><path d="M17 17l2 2 3-4" /></>,
  Documents: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  Changes: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  Payments: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  'My money': <path d="M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 2.6 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3" />,
  Ratings: <path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.3l6-.7z" />,
  'Price check': <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></>,
};

export default function ProjectTabs({ id, priceCheck = false, rating = false, money = false, dots = [] }: { id: string; priceCheck?: boolean; rating?: boolean; money?: boolean; dots?: string[] }) {
  const path = usePathname();
  const base = `/projects/${id}`;
  const tabs = [
    [`${base}/overview`, 'Overview'],
    [base, 'Messages'],
    [`${base}/agreement`, 'Agreement'],
    [`${base}/photos`, 'Photos'],
    [`${base}/schedule`, 'Schedule'],
    [`${base}/selections`, 'Selections'],
    [`${base}/documents`, 'Documents'],
    [`${base}/changes`, 'Changes'],
    [`${base}/payments`, 'Payments'],
    ...(money ? [[`${base}/money`, 'My money']] : []),
    ...(rating ? [[`${base}/rating`, 'Ratings']] : []),
    ...(priceCheck ? [[`${base}/price-check`, 'Price check']] : []),
  ];
  return (
    <nav className="ptabs" aria-label="Project sections" style={{ gridTemplateColumns: `repeat(${tabs.length === 9 || tabs.length === 6 ? 3 : 4}, 1fr)` }}>
      {tabs.map(([href, label]) => {
        const active = href === base ? path === base : path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[label]}</svg>
            <span>{label}</span>
            {dots.includes(label) ? <span className="ptab-dot" aria-label="Needs you" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
