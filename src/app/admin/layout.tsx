import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <nav className="row" aria-label="Admin">
        {[
          ['/admin', 'Overview'],
          ['/admin/activity', 'Activity'],
          ['/admin/users', 'Users'],
          ['/admin/projects', 'Projects'],
          ['/admin/reviews', 'Reviews'],
          ['/admin/verification', 'Insurance'],
          ['/admin/marketplace', 'Marketplace'],
          ['/admin/broadcast', 'Broadcast'],
          ['/admin/area', 'By area'],
          ['/admin/audit', 'Audit log'],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="btn ghost" style={{ minHeight: 36, padding: '6px 14px' }}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
