import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isAdminEmail, requireAdmin } from '@/lib/admin';
import { loadFeed, lookups } from '@/lib/adminFeed';
import AdminFeed from '@/components/AdminFeed';
import { BanForm, MessageForm } from '@/components/AdminForms';
import { banUser, sendBroadcast, unbanUser } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function UserPage({ params }: { params: { id: string } }) {
  const { db, user: me } = await requireAdmin();
  const { data: u } = await db.from('profiles').select('*').eq('id', params.id).maybeSingle();
  if (!u) notFound();

  const [{ data: pm }, { data: cm }] = await Promise.all([
    db.from('project_members').select('project_id,role').eq('user_id', u.id),
    db.from('company_members').select('company_id,role').eq('user_id', u.id),
  ]);
  const cids = (cm ?? []).map((c) => c.company_id);
  const [{ data: companies }, { data: companyProjects }] = await Promise.all([
    cids.length ? db.from('companies').select('id,name').in('id', cids) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    cids.length ? db.from('projects').select('id,name,company_id').in('company_id', cids) : Promise.resolve({ data: [] as { id: string; name: string; company_id: string }[] }),
  ]);
  const memberIds = (pm ?? []).map((m) => m.project_id);
  const { data: memberProjects } = memberIds.length ? await db.from('projects').select('id,name').in('id', memberIds) : { data: [] as { id: string; name: string }[] };
  const roleOf = Object.fromEntries((pm ?? []).map((m) => [m.project_id, m.role]));
  const projs = new Map<string, { id: string; name: string; role: string }>();
  (memberProjects ?? []).forEach((p) => projs.set(p.id, { ...p, role: roleOf[p.id] }));
  (companyProjects ?? []).forEach((p) => projs.set(p.id, { id: p.id, name: p.name, role: 'contractor (company)' }));

  const events = await loadFeed({ userId: u.id, limit: 50 });
  const names = await lookups(events);
  const isAdmin = isAdminEmail(u.email);

  return (
    <>
      <h1>{u.email}</h1>
      <div className="card">
        <div className="row">
          {u.banned_at ? <span className="pill bad">suspended</span> : <span className="pill ok">active</span>}
          {isAdmin && <span className="pill">admin</span>}
        </div>
        <div className="small muted">
          {u.full_name || 'No name set'} · {u.phone || 'No phone'} · joined {new Date(u.created_at).toLocaleDateString('en-US')}
          {companies?.length ? ` · Company: ${companies.map((c) => c.name).join(', ')}` : ''}
        </div>
        {u.banned_at && <div className="small">Reason: {u.ban_reason || '—'}</div>}
      </div>

      <h2>Projects</h2>
      <div className="card" style={{ gap: 6 }}>
        {projs.size === 0 && <span className="muted">None.</span>}
        {Array.from(projs.values()).map((p) => (
          <div key={p.id}>
            <Link href={`/admin/projects/${p.id}`}>{p.name}</Link> <span className="muted small">· {p.role}</span>
          </div>
        ))}
      </div>

      {u.id !== me.id && !isAdmin && (
        <>
          <h2>{u.banned_at ? 'Restore access' : 'Suspend access'}</h2>
          <div className="card">
            <p className="small muted">
              Suspending blocks sign-in and stops their current session, and they stop receiving alerts. Their projects and records stay intact for the other party.
            </p>
            <BanForm userId={u.id} banned={!!u.banned_at} action={u.banned_at ? unbanUser : banUser} />
          </div>
        </>
      )}

      <h2>Message this person</h2>
      <div className="card">
        <MessageForm action={sendBroadcast} audience="user" target={u.id} />
      </div>

      <h2>Their activity</h2>
      <AdminFeed events={events} names={names} />
    </>
  );
}
