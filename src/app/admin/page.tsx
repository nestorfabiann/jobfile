import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAnyAdmin, ROLE_AREAS } from '@/lib/admin';
import { loadFeed, lookups } from '@/lib/adminFeed';
import AdminFeed from '@/components/AdminFeed';
import { attentionItems, ageText } from '@/lib/adminHealth';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const { db, role } = await requireAnyAdmin();
  if (role !== 'owner') {
    const first = ROLE_AREAS[role][0];
    redirect(first === 'verification' ? '/admin/verification' : first === 'reviews' ? '/admin/reviews' : first === 'help' ? '/admin/help' : '/admin/audit');
  }
  const day = new Date(Date.now() - 24 * 3600_000).toISOString();
  const week = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const count = async (table: string, f?: (q: any) => any) => {
    let q: any = db.from(table).select('*', { count: 'exact', head: true });
    if (f) q = f(q);
    const { count } = await q;
    return count ?? 0;
  };
  const [users, banned, projects, signed, msgs24, newUsers7, failed, pending] = await Promise.all([
    count('profiles'),
    count('profiles', (q) => q.not('banned_at', 'is', null)),
    count('projects'),
    count('agreements', (q) => q.not('executed_at', 'is', null)),
    count('messages', (q) => q.gt('created_at', day)),
    count('profiles', (q) => q.gt('created_at', week)),
    count('notifications', (q) => q.not('error', 'is', null).gt('created_at', week)),
    count('agreement_milestones', (q) => q.in('pay_status', ['requested', 'paid'])),
  ]);
  const attention = await attentionItems(db);
  const events = await loadFeed({ limit: 25 });
  const names = await lookups(events);
  const tiles: [string, number, string?][] = [
    ['Users', users, '/admin/users'],
    ['New this week', newUsers7],
    ['Suspended', banned],
    ['Projects', projects, '/admin/projects'],
    ['Signed agreements', signed],
    ['Messages, 24h', msgs24],
    ['Payments in progress', pending],
    ['Failed alerts, 7d', failed],
  ];
  return (
    <>
      <h1>Admin</h1>
      <section className="card why" aria-label="Needs attention">
        <h2 style={{ fontSize: 20 }}>Needs attention <span style={{ color: 'var(--accent)' }}>{attention.length}</span></h2>
        <p className="muted small" style={{ margin: 0 }}>Oldest first. Each one leaves this list when it is handled.</p>
        {attention.length === 0 ? <p style={{ margin: 0 }}>Nothing is waiting on you.</p> : attention.map((a) => (
          <div key={a.key} className="card" style={{ gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <b>{a.title}</b>
              <Link className="btn" href={a.href} style={{ minHeight: 40, padding: '6px 16px' }}>{a.go}</Link>
            </div>
            <span className="muted small">{a.sub} · {ageText(a.at)}</span>
          </div>
        ))}
      </section>
      <div className="tiles">
        {tiles.map(([label, n, href]) => (
          <div className="tile" key={label}>
            <div className="small muted">{label}</div>
            <div className="big">{href ? <Link href={href}>{n}</Link> : n}</div>
          </div>
        ))}
      </div>
      <h2>Recent activity</h2>
      <AdminFeed events={events} names={names} />
      <p><Link href="/admin/activity">See all activity</Link></p>
    </>
  );
}
