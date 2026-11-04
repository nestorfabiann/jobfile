import { requireAnyAdmin, ROLE_AREAS, type AdminRole, type Area } from '@/lib/admin';
import AdminNav, { type NavGroup } from '@/components/AdminNav';

// [link, label, area a team member needs]. Links with no area are Owner only.
type L = [string, string, Area | null];
const GROUPS: { key: string; label: string; links: L[] }[] = [
  { key: 'ov', label: 'Overview', links: [['/admin', 'Overview', null], ['/admin/activity', 'Activity', null], ['/admin/usage', 'Usage', null], ['/admin/installs', 'App installs', null], ['/admin/health', 'Health', null]] },
  { key: 'pe', label: 'People', links: [['/admin/users', 'Users', 'view'], ['/admin/projects', 'Projects', 'view'], ['/admin/invites', 'Invites', null]] },
  { key: 'rv', label: 'Review', links: [['/admin/help', 'Help', 'help'], ['/admin/verification', 'Insurance', 'verification'], ['/admin/reviews', 'Reviews', 'reviews'], ['/admin/marketplace', 'Marketplace', 'listings']] },
  { key: 'ms', label: 'Message', links: [['/admin/broadcast', 'Broadcast', null], ['/admin/area', 'By area', null]] },
  { key: 'ad', label: 'Admin', links: [['/admin/team', 'Team', null], ['/admin/audit', 'Audit log', 'audit']] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const who = await requireAnyAdmin();
  const role: AdminRole = who.role;
  const allowed: Area[] = role === 'owner' ? [] : ROLE_AREAS[role];
  const can = (area: Area | null) => role === 'owner' || (area !== null && allowed.includes(area));

  // Open items for the red counts: Help messages not done, insurance waiting for a check.
  const counts: Record<string, number> = {};
  if (can('help')) {
    try {
      const { count } = await who.db.from('help_messages').select('id', { count: 'exact', head: true }).is('done_at', null);
      counts['/admin/help'] = count ?? 0;
    } catch { /* table not created yet */ }
  }
  if (can('verification')) {
    try {
      const { count } = await who.db.from('company_insurance').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      counts['/admin/verification'] = count ?? 0;
    } catch { /* ignore */ }
  }

  const groups: NavGroup[] = GROUPS.map((g) => {
    const links = g.links.filter(([, , area]) => can(area)).map(([href, label]) => ({ href, label, badge: counts[href] ?? 0 }));
    return { key: g.key, label: g.label, badge: links.reduce((s, l) => s + l.badge, 0), links };
  }).filter((g) => g.links.length > 0);

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AdminNav groups={groups} />
      {children}
    </div>
  );
}
