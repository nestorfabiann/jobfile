import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isAdminEmail, requireAdmin } from '@/lib/admin';
import { loadFeed, lookups } from '@/lib/adminFeed';
import { ago, avgVisitMs, DAY, fmtDuration, loadEvents, visitsOf } from '@/lib/usageStats';
import AdminFeed from '@/components/AdminFeed';
import { BanForm, MessageForm } from '@/components/AdminForms';
import { banUser, sendBroadcast, unbanUser } from '../../actions';
import { EditForm, ActionRow, NoteForm } from '@/components/AdminProfileForms';
import { editUser, signOutEverywhere, alertsOff, deleteUser, addNote } from '../../profileActions';

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
  const uev = await loadEvents(db, null, u.id);
  const uvisits = visitsOf(uev);
  const recentVisits = uvisits.filter((v) => v.start > Date.now() - 30 * DAY);
  const lastEv = uev.length ? uev[uev.length - 1].created_at : null;
  const recentPages = uev.filter((e) => e.kind === 'view').slice(-12).reverse();
  const isAdmin = isAdminEmail(u.email);
  let invitedBy = '';
  try {
    const { data: j } = await db.from('invite_events').select('code').eq('invitee_id', u.id).eq('kind', 'join').maybeSingle();
    if (j?.code) {
      const { data: c } = await db.from('invite_codes').select('user_id').eq('code', j.code as string).maybeSingle();
      if (c?.user_id) {
        const { data: o } = await db.from('profiles').select('full_name,email').eq('id', c.user_id as string).maybeSingle();
        invitedBy = (o?.full_name || o?.email || '') as string;
      }
    }
  } catch { /* invites not set up yet */ }
  const { data: notes } = await db.from('admin_notes').select('id,body,author_email,created_at').eq('subject_type', 'user').eq('subject_id', u.id).order('created_at', { ascending: false }).limit(50);

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
          {companies?.length ? ' · Company: ' : ''}{(companies ?? []).map((c, i) => (<span key={c.id}>{i ? ', ' : ''}<Link href={`/admin/companies/${c.id}`}>{c.name}</Link></span>))}
        </div>
        {u.banned_at && <div className="small">Reason: {u.ban_reason || '—'}</div>}
        {invitedBy ? <div className="small muted">Invited by {invitedBy}</div> : null}
      </div>

      {!isAdmin && (
        <>
          <h2>Profile</h2>
          <div className="card">
            <EditForm
              title={u.email}
              action={editUser}
              hidden={{ user_id: u.id }}
              fields={[
                { name: 'full_name', label: 'Name', value: u.full_name ?? '' },
                { name: 'phone', label: 'Phone', value: u.phone ?? '', inputMode: 'tel' },
                { name: 'email', label: 'Email', value: u.email ?? '', inputMode: 'email', hint: 'Changing an email signs the person out. They sign in again with the new address. The old one is kept in the audit log.' },
              ]}
            />
          </div>
          {u.id !== me.id && (
            <>
              <h2>Actions</h2>
              <div className="card">
                <ActionRow label="Sign out everywhere" desc="Ends every session. They can sign in again." button="Sign out" action={signOutEverywhere} hidden={{ user_id: u.id }} />
                <ActionRow label="Turn alerts off" desc="Stops email and text alerts, for example after bounces." button="Turn off" action={alertsOff} hidden={{ user_id: u.id }} />
                <ActionRow label="Delete account" desc="Only if they have no projects, company or posted jobs. Otherwise suspend." button="Delete" danger action={deleteUser} hidden={{ user_id: u.id }} />
              </div>
            </>
          )}
        </>
      )}

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

      <h2>Private notes</h2>
      <div className="card">
        <p className="small muted" style={{ margin: 0 }}>Only admins see these. They are never shown to the person.</p>
        {(notes ?? []).map((n: any) => (
          <div key={n.id} className="box" style={{ background: 'var(--surface-2)' }}><b>{new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {n.author_email}:</b> {n.body}</div>
        ))}
        <NoteForm type="user" id={u.id} action={addNote} />
      </div>

      <h2>Message this person</h2>
      <div className="card">
        <MessageForm action={sendBroadcast} audience="user" target={u.id} />
      </div>

      <h2>Usage</h2>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Sign-ins</span><b>{uev.filter((e) => e.kind === 'signin').length}</b></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Last seen</span><b>{ago(lastEv)}</b></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Visits (30 days)</span><b>{recentVisits.length}</b></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Avg. visit</span><b>{fmtDuration(avgVisitMs(recentVisits))}</b></div>
        {recentPages.length > 0 && <>
          <h3 style={{ margin: 0 }}>Recent pages</h3>
          {recentPages.map((e, i) => <div key={i} className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 6 }}><span>{e.page}</span><span className="muted small">{new Date(e.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>)}
        </>}
      </div>

      <h2>Their activity</h2>
      <AdminFeed events={events} names={names} />
    </>
  );
}
