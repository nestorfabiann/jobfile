import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import AdminRecommend from '@/components/AdminRecommend';
import { categoryLabel, describeFix, needsMediator, type Issue, type IssueEvent } from '@/lib/issues';
import { sendRecommendation } from '../actions';

export const dynamic = 'force-dynamic';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

export default async function Mediation() {
  const { db } = await requireAdmin();
  let rows: (Issue & { projects?: { name: string; homeowner_name: string | null } })[] = [];
  let events: IssueEvent[] = [];
  try {
    const { data } = await db.from('project_issues').select('*, projects(name,homeowner_name)').eq('status', 'open').order('created_at', { ascending: true });
    rows = ((data ?? []) as any[]).filter((i) => needsMediator(i));
    if (rows.length) events = ((await db.from('issue_events').select('*').in('issue_id', rows.map((r) => r.id)).order('created_at')).data ?? []) as IssueEvent[];
  } catch { /* table not created yet */ }
  return (
    <>
      <h1>Mediation</h1>
      <p className="muted small">Owner only. Problems that are past the answer deadline, or where someone asked Jobfile to look. Read the record, then send a recommendation to both sides. It is not binding and Jobfile does not hold money.</p>
      {rows.length === 0 && <div className="card"><p className="muted">Nothing needs a mediator.</p></div>}
      {rows.map((i) => {
        const ev = events.filter((e) => e.issue_id === i.id);
        const props = ev.filter((e) => e.kind === 'proposal');
        return (
          <div className="card" key={i.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{i.projects?.name ?? 'Project'}</b>
              <span className="pill warn">{i.escalated_at ? 'Asked for help' : 'Stuck'} · day {Math.max(1, Math.ceil((Date.now() - new Date(i.created_at).getTime()) / 86400000))}</span>
            </div>
            <p className="muted small" style={{ margin: 0 }}>{categoryLabel(i.category)} · reported by the {i.reporter_role} on {day(i.created_at)}</p>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{i.description}</p>
            <div className="small">
              <b>Where they are</b>
              {props.length === 0 ? <div className="muted">No fixes proposed yet.</div> : props.map((p) => <div key={p.id}>{day(p.created_at)} · {p.side}: {describeFix(p)}{p.body ? ` — "${p.body}"` : ''}</div>)}
              {ev.filter((e) => e.kind === 'note').map((n) => <div key={n.id}>{day(n.created_at)} · {n.side} sees it differently: "{n.body}"</div>)}
            </div>
            <div className="row"><Link className="btn ghost" href={`/admin/projects/${i.project_id}`}>Open the project record</Link></div>
            {i.mediator_note ? <p className="small"><b>Last recommendation ({i.mediator_sent_at ? day(i.mediator_sent_at) : ''}):</b> {i.mediator_note}</p> : null}
            <AdminRecommend id={i.id} send={sendRecommendation} />
          </div>
        );
      })}
    </>
  );
}
