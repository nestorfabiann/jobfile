import Link from 'next/link';
import { requireAnyAdmin, ROLE_AREAS, type Area } from '@/lib/admin';

// [link, label, area a team member needs]. Links with no area are Owner only.
const LINKS: [string, string, Area | null][] = [
  ['/admin', 'Overview', null],
  ['/admin/activity', 'Activity', null],
  ['/admin/usage', 'Usage', null],
  ['/admin/users', 'Users', 'view'],
  ['/admin/projects', 'Projects', 'view'],
  ['/admin/reviews', 'Reviews', 'reviews'],
  ['/admin/verification', 'Insurance', 'verification'],
  ['/admin/marketplace', 'Marketplace', 'listings'],
  ['/admin/help', 'Help', 'help'],
  ['/admin/invites', 'Invites', null],
  ['/admin/health', 'Health', null],
  ['/admin/broadcast', 'Broadcast', null],
  ['/admin/area', 'By area', null],
  ['/admin/team', 'Team', null],
  ['/admin/audit', 'Audit log', 'audit'],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireAnyAdmin();
  const shown = LINKS.filter(([, , area]) => role === 'owner' || (area !== null && ROLE_AREAS[role].includes(area)));
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <nav className="row" aria-label="Admin">
        {shown.map(([href, label]) => (
          <Link key={href} href={href} className="btn ghost" style={{ minHeight: 36, padding: '6px 14px' }}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
