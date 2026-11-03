import Link from 'next/link';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { FAQ, TOPICS, topicLabel } from '@/lib/help';
import { sendHelp } from './actions';
import PendingButton from '@/components/PendingButton';

export const dynamic = 'force-dynamic';

export default async function Help({ searchParams }: { searchParams: { sent?: string; error?: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  let projects: { id: string; name: string }[] = [];
  let mine: any[] = [];
  if (user) {
    const { data: ps } = await sb.from('projects').select('id,name').order('created_at', { ascending: false }).limit(20);
    projects = (ps ?? []) as { id: string; name: string }[];
    const { data: ms } = await supabaseAdmin().from('help_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
    mine = (ms ?? []) as any[];
  }

  return (
    <>
      <div className="stack">
        <h1>How can we help?</h1>
        <p className="muted">We read every message and reply inside Jobfile, usually within one business day.</p>
      </div>

      <div className="stack">
        <h2 style={{ fontSize: 20 }}>Quick answers</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="card" style={{ padding: '12px 16px' }}>
            <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{q}</summary>
            <p className="muted" style={{ margin: '8px 0 0' }}>{a}</p>
          </details>
        ))}
      </div>

      {!user ? (
        <div className="card">
          <h2>Still need help?</h2>
          <p className="muted">Sign in and send us a message. We reply inside Jobfile.</p>
          <div className="row"><Link className="btn" href="/login?next=/help">Sign in</Link></div>
        </div>
      ) : (
        <>
          {searchParams.sent ? <div className="box ok">Sent. We will reply here in Jobfile, and you will get an alert when we do.</div> : null}
          {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
          <form action={sendHelp} className="card">
            <h2>Send us a message</h2>
            <div className="fld">
              <span>What is this about?</span>
              <div className="chips" role="radiogroup" aria-label="Topic">
                {TOPICS.map(([v, l], i) => (
                  <label className="chip" key={v}><input type="radio" name="topic" value={v} defaultChecked={i === 0} /><span>{l}</span></label>
                ))}
              </div>
            </div>
            {projects.length > 0 && (
              <label className="fld">
                Which project?
                <select name="project_id" defaultValue="">
                  <option value="">None, it is general</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            <label className="fld">
              Tell us what happened
              <textarea name="body" rows={5} required maxLength={2000} placeholder="What did you try, and what did you see?" />
            </label>
            <p className="muted small" style={{ margin: 0 }}>We attach your name, account email and the page you were on, so you do not have to type them.</p>
            <PendingButton pendingText="Sending…">Send message</PendingButton>
          </form>

          {mine.length > 0 && (
            <div className="stack">
              <h2 style={{ fontSize: 20 }}>Your messages</h2>
              {mine.map((m) => (
                <div key={m.id} className="card" style={{ gap: 6 }}>
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <span className="pill">{topicLabel(m.topic)}</span>
                    <span className="muted small">{new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.body}</p>
                  {m.reply ? (
                    <div className="box ok" style={{ whiteSpace: 'pre-wrap' }}><b>Our reply:</b> {m.reply}</div>
                  ) : (
                    <span className="muted small">Waiting for our reply.</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
