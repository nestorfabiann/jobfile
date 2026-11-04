import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { topicLabel } from '@/lib/help';
import { ageText } from '@/lib/adminHealth';
import PendingButton from '@/components/PendingButton';
import { replyHelp, markHelpDone } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminHelp() {
  const { db } = await requireAdmin('help');
  const { data } = await db.from('help_messages').select('*').order('created_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as any[];
  const ids = Array.from(new Set(rows.map((r) => r.user_id as string)));
  const pids = Array.from(new Set(rows.map((r) => r.project_id as string | null).filter(Boolean))) as string[];
  const ps: any[] = ids.length ? ((await db.from('profiles').select('id,full_name,email').in('id', ids)).data as any[]) ?? [] : [];
  const pj: any[] = pids.length ? ((await db.from('projects').select('id,name').in('id', pids)).data as any[]) ?? [] : [];
  const who = new Map<string, any>(ps.map((p: any) => [p.id as string, p] as [string, any]));
  const proj = new Map<string, string>(pj.map((p: any) => [p.id as string, p.name as string] as [string, string]));
  const open = rows.filter((r) => !r.done_at).sort((a, b) => (a.topic === 'report' ? 0 : 1) - (b.topic === 'report' ? 0 : 1) || +new Date(a.created_at) - +new Date(b.created_at));
  const done = rows.filter((r) => r.done_at).slice(0, 20);

  const card = (m: any, isOpen: boolean) => {
    const p = who.get(m.user_id);
    return (
      <div key={m.id} className="card" style={{ gap: 8, opacity: isOpen ? 1 : 0.75 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <b>{p?.full_name || p?.email || 'Someone'}</b>
          <span className="muted small">{ageText(m.created_at)}</span>
        </div>
        <div className="row">
          <span className={m.topic === 'report' ? 'pill warn' : 'pill'}>{topicLabel(m.topic)}</span>
          {m.project_id && proj.get(m.project_id) ? <span className="pill">{proj.get(m.project_id)}</span> : null}
          {!isOpen ? <span className="pill ok">Done</span> : null}
        </div>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.body}</p>
        <span className="muted small">{[p?.email, m.page && `Page: ${m.page}`, m.device].filter(Boolean).join(' · ')}</span>
        {m.reply ? <div className="box ok" style={{ whiteSpace: 'pre-wrap' }}><b>Reply sent:</b> {m.reply}</div> : null}
        {isOpen && (
          <>
            <form action={replyHelp} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="hidden" name="id" value={m.id} />
              <textarea name="reply" rows={3} required maxLength={2000} aria-label="Reply" placeholder="Write a reply. They get an alert and see it in Help." />
              <PendingButton pendingText="Sending…">Send reply and mark done</PendingButton>
            </form>
            <div className="row">
              <Link className="btn ghost" href={`/admin/users/${m.user_id}`} style={{ minHeight: 40 }}>Open their profile</Link>
              <form action={markHelpDone}><input type="hidden" name="id" value={m.id} /><PendingButton className="btn ghost" pendingText="Saving…">Mark done</PendingButton></form>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <h1>Help inbox</h1>
      <p className="muted small" style={{ margin: 0 }}>Reports about a person or post come first, then the oldest open message.</p>
      <h2 style={{ fontSize: 20 }}>Open <span style={{ color: 'var(--accent)' }}>{open.length}</span></h2>
      {open.length === 0 ? <p className="muted">Nothing is waiting on you.</p> : open.map((m) => card(m, true))}
      {done.length > 0 && <h2 style={{ fontSize: 20 }}>Recently done</h2>}
      {done.map((m) => card(m, false))}
    </>
  );
}
