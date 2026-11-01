import Link from 'next/link';
import { notFound } from 'next/navigation';
import { audit, requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function Conversation({ params }: { params: { id: string } }) {
  const { db, user } = await requireAdmin();
  const { data: p } = await db.from('projects').select('id,name').eq('id', params.id).maybeSingle();
  if (!p) notFound();
  const { data: msgs } = await db
    .from('messages')
    .select('id,sender_role,tag,body,created_at')
    .eq('project_id', p.id)
    .order('created_at', { ascending: false })
    .limit(200);
  // Logged on every open.
  await audit(user, 'view_conversation', { type: 'project', id: p.id }, { name: p.name, messages: msgs?.length ?? 0 });

  return (
    <>
      <p><Link href={`/admin/projects/${p.id}`}>← Back to project</Link></p>
      <h1>{p.name}: conversation</h1>
      <p className="small muted">This view was recorded in the audit log. Showing the latest 200 messages, newest first.</p>
      <div className="card" style={{ gap: 12 }}>
        {(msgs ?? []).map((m) => (
          <div key={m.id}>
            <div className="small muted">
              <span className={`pill ${m.sender_role}`}>{m.sender_role}</span>{' '}
              {m.tag && <span className="pill">{m.tag}</span>}{' '}
              {new Date(m.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
          </div>
        ))}
        {!msgs?.length && <span className="muted">No messages.</span>}
      </div>
    </>
  );
}
