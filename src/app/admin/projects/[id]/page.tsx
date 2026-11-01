import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { loadFeed, lookups } from '@/lib/adminFeed';
import AdminFeed from '@/components/AdminFeed';
import { MessageForm } from '@/components/AdminForms';
import { dollars } from '@/lib/money';
import { sendBroadcast } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const { db } = await requireAdmin();
  const { data: p } = await db.from('projects').select('*, companies(name)').eq('id', params.id).maybeSingle();
  if (!p) notFound();

  const [{ data: members }, { data: staff }, { data: ag }, { data: items }, { data: ms }, { data: sigs }, { count: msgCount }] = await Promise.all([
    db.from('project_members').select('user_id,role').eq('project_id', p.id),
    db.from('company_members').select('user_id').eq('company_id', p.company_id),
    db.from('agreements').select('sent_at,executed_at,revision').eq('project_id', p.id).maybeSingle(),
    db.from('agreement_items').select('price_cents').eq('project_id', p.id),
    db.from('agreement_milestones').select('label,pct,pay_status,position').eq('project_id', p.id).order('position'),
    db.from('agreement_signatures').select('role').eq('project_id', p.id),
    db.from('messages').select('id', { count: 'exact', head: true }).eq('project_id', p.id),
  ]);
  const uids = Array.from(new Set([...(members ?? []), ...(staff ?? [])].map((m) => m.user_id as string)));
  const { data: people } = uids.length ? await db.from('profiles').select('id,email,banned_at').in('id', uids) : { data: [] as { id: string; email: string; banned_at: string | null }[] };
  const roles = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.role]));
  const staffIds = new Set((staff ?? []).map((s) => s.user_id));

  const base = (items ?? []).reduce((s, i) => s + i.price_cents, 0);
  const events = await loadFeed({ projectId: p.id, limit: 60 });
  const names = await lookups(events);

  return (
    <>
      <h1>{p.name}</h1>
      <div className="card">
        <div className="small muted">
          {p.address || 'No address'} · {(p as any).companies?.name} · created {new Date(p.created_at).toLocaleDateString('en-US')}
        </div>
        <div>
          Agreement: {ag?.executed_at ? 'fully signed' : ag?.sent_at ? `sent, ${sigs?.length ?? 0} of 2 signatures` : 'draft'} · Contract base {dollars(base)}
        </div>
        <div>Messages: {msgCount ?? 0}</div>
      </div>

      <h2>People</h2>
      <div className="card" style={{ gap: 6 }}>
        {(people ?? []).map((u) => (
          <div key={u.id}>
            <Link href={`/admin/users/${u.id}`}>{u.email}</Link>{' '}
            <span className="muted small">· {roles[u.id] ?? (staffIds.has(u.id) ? 'contractor (company)' : '')}</span>
            {u.banned_at && <span className="pill bad" style={{ marginLeft: 8 }}>suspended</span>}
          </div>
        ))}
        {!(people ?? []).some((u) => roles[u.id] === 'homeowner') && (
          <div className="muted small">Homeowner {p.homeowner_email} has not signed in yet.</div>
        )}
      </div>

      <h2>Payments</h2>
      <div className="card" style={{ gap: 6 }}>
        {(ms ?? []).length === 0 && <span className="muted">No milestones.</span>}
        {(ms ?? []).map((m) => (
          <div key={m.position} className="row" style={{ justifyContent: 'space-between' }}>
            <span>{m.label} <span className="muted small">· {Number(m.pct)}%</span></span>
            <span className="pill">{m.pay_status}</span>
          </div>
        ))}
      </div>

      <h2>Conversation</h2>
      <div className="card">
        <p className="small muted">Reading what the two sides wrote is logged in the audit log. Only open it for support or a complaint.</p>
        <Link prefetch={false} href={`/admin/projects/${p.id}/conversation`} className="btn ghost">
          View conversation
        </Link>
      </div>

      <h2>Message everyone on this project</h2>
      <div className="card">
        <MessageForm action={sendBroadcast} audience="project" target={p.id} />
      </div>

      <h2>Timeline</h2>
      <AdminFeed events={events} names={names} />
    </>
  );
}
