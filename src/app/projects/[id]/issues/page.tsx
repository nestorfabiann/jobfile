import Link from 'next/link';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { categoryLabel, FIXES, ISSUE_CATEGORIES, RESPOND_DAYS, type Issue } from '@/lib/issues';
import { reportIssue } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Problems · Jobfile' };

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

export default async function Issues({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; new?: string } }) {
  const { project, role, contractorName, homeownerName } = await loadProject(params.id);
  const base = `/projects/${project.id}`;
  const otherName = role === 'homeowner' ? contractorName : homeownerName;
  let rows: Issue[] = [];
  try {
    const { data } = await supabaseAdmin().from('project_issues').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
    rows = (data ?? []) as Issue[];
  } catch { /* table not created yet */ }
  const mine = (i: Issue) => i.reporter_role === role;
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 90 }}>
      <Link href={`${base}/overview`} className="small" style={{ fontWeight: 700 }}>‹ {project.name}</Link>
      <h1>Problems</h1>
      <p className="muted">If you and {otherName} cannot agree on something, report it here. Nobody is blamed. You each suggest a fix, and when one of you accepts the other&rsquo;s, it is saved in the project. Jobfile does not hold money or decide who is right.</p>
      {searchParams.error ? <div className="box warn" role="alert">{searchParams.error}</div> : null}

      {rows.length > 0 && (
        <section className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Reported problems">
          {rows.map((i) => (
            <Link key={i.id} href={`${base}/issues/${i.id}`} className="card" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <b>{categoryLabel(i.category)}</b>
                <span className={`pill ${i.status === 'agreed' ? 'ok' : i.status === 'open' ? 'warn' : ''}`}>{i.status === 'agreed' ? 'Settled' : i.status === 'open' ? 'Open' : 'Withdrawn'}</span>
              </div>
              <p className="muted small" style={{ margin: 0 }}>{i.description.length > 110 ? `${i.description.slice(0, 109)}…` : i.description}</p>
              <span className="muted small">{mine(i) ? 'You reported it' : `${otherName} reported it`} · {when(i.created_at)}{i.status === 'agreed' && i.agreed_summary ? ` · ${i.agreed_summary}` : ''}</span>
            </Link>
          ))}
        </section>
      )}

      <details className="card" open={!!searchParams.new || rows.length === 0 || !!searchParams.error}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, listStyle: 'none' }}>＋ Report a problem</summary>
        <form action={reportIssue} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <input type="hidden" name="project_id" value={project.id} />
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small" style={{ fontWeight: 700, marginBottom: 6 }}>What kind of problem?</legend>
            <div className="chips">
              {ISSUE_CATEGORIES.map(([k, l], n) => <label className="chip" key={k}><input type="radio" name="category" value={k} defaultChecked={n === 0} /><span>{l}</span></label>)}
            </div>
          </fieldset>
          <label className="fld">What happened
            <textarea name="description" rows={4} maxLength={2000} required placeholder="Say what you saw, when, and what you already tried." />
          </label>
          <p className="muted small" style={{ margin: 0 }}>Photos help a lot. Add them in the <Link href={`${base}/photos`} style={{ fontWeight: 700 }}>Photos tab</Link> first. They stay on the project record.</p>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small" style={{ fontWeight: 700, marginBottom: 6 }}>What would feel fair? (optional)</legend>
            <div className="chips">
              <label className="chip"><input type="radio" name="wants" value="" defaultChecked /><span>Not sure</span></label>
              {FIXES.filter((f) => f[0] !== 'disagree').map(([k, l]) => <label className="chip" key={k}><input type="radio" name="wants" value={k} /><span>{l}</span></label>)}
            </div>
          </fieldset>
          <button className="btn" type="submit">Send to {otherName}</button>
          <p className="muted small" style={{ margin: 0 }}>{otherName} has {RESPOND_DAYS} days to answer. Messages, photos and payments stay on the project record.</p>
        </form>
      </details>
    </div>
  );
}
