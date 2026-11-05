import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { milestoneAmounts, totals, type ChangeOrder, type Item, type Milestone } from '@/lib/agreement';
import { categoryLabel, describeFix, FIXES, RESPOND_DAYS, type Issue, type IssueEvent } from '@/lib/issues';
import { acceptFix, askJobfile, deleteIssuePhoto, proposeFix, withdrawIssue } from '../actions';
import { IssuePhotoAdder } from '@/components/IssuePhotos';
import { signedUrls } from '@/lib/companyProfile';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Problem · Jobfile' };

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

export default async function IssuePage({ params, searchParams }: { params: { id: string; issueId: string }; searchParams: { ok?: string; error?: string } }) {
  const { sb, project, role, user, contractorName, homeownerName } = await loadProject(params.id);
  const base = `/projects/${project.id}`;
  const db = supabaseAdmin();
  const { data: iss } = await db.from('project_issues').select('*').eq('id', params.issueId).eq('project_id', project.id).maybeSingle<any>();
  if (!iss) notFound();
  const issue = iss as Issue;
  const { data: evRows } = await db.from('issue_events').select('*').eq('issue_id', issue.id).order('created_at');
  const events = (evRows ?? []) as IssueEvent[];
  let iphotos: { id: string; path: string; side: string; uploaded_by: string }[] = [];
  try { iphotos = ((await db.from('issue_photos').select('id,path,side,uploaded_by').eq('issue_id', issue.id).order('created_at')).data ?? []) as typeof iphotos; } catch { /* table not created yet */ }
  const purls = iphotos.length ? await signedUrls('project-photos', iphotos.map((p) => p.path)) : new Map<string, string>();
  const other = role === 'homeowner' ? 'contractor' : 'homeowner';
  const nameOf = (s: string) => (s === 'jobfile' ? 'Jobfile' : s === role ? 'You' : s === 'homeowner' ? homeownerName : contractorName);
  const otherName = nameOf(other);
  const reporterName = issue.reporter_role === role ? 'You' : nameOf(issue.reporter_role);

  // What is on the project record, from the same sources as the closeout checklist.
  const [{ data: itemRows }, { data: coRows }, { data: msRows }, { data: photoRows }, { data: agr }] = await Promise.all([
    sb.from('agreement_items').select('*').eq('project_id', project.id),
    sb.from('change_orders').select('*').eq('project_id', project.id),
    sb.from('agreement_milestones').select('*').eq('project_id', project.id).order('position'),
    sb.from('photos').select('id', { count: 'exact', head: false }).eq('project_id', project.id),
    sb.from('agreements').select('executed_at').eq('project_id', project.id).maybeSingle(),
  ]);
  const items = (itemRows ?? []) as Item[];
  const cos = (coRows ?? []) as ChangeOrder[];
  const t = totals(items, cos);
  const pms = ((msRows ?? []) as (Milestone & { pay_status: string })[]).map((m) => ({ ...m, pct: Number(m.pct) }));
  const amts = milestoneAmounts(t.base, pms);
  const coBill = (cos as any[]).filter((c) => c.status === 'approved' && c.cost_cents > 0);
  const confirmed = pms.reduce((s, m, i) => (m.pay_status === 'confirmed' ? s + amts[i] : s), 0) + coBill.reduce((s, c) => ((c.pay_status ?? 'scheduled') === 'confirmed' ? s + c.cost_cents : s), 0);
  const approvedCos = (cos as any[]).filter((c) => c.status === 'approved').length;

  const open = issue.status === 'open';
  const late = Date.now() > new Date(issue.respond_by).getTime();
  const daysLeft = Math.max(0, Math.ceil((new Date(issue.respond_by).getTime() - Date.now()) / 86400000));
  const proposals = events.filter((e) => e.kind === 'proposal');
  const theirLatest = [...proposals].reverse().find((e) => e.side === other);
  const iAnswered = events.some((e) => (e.kind === 'proposal' || e.kind === 'note') && e.side === role);
  const theyAnswered = events.some((e) => (e.kind === 'proposal' || e.kind === 'note') && e.side === other);
  const sideAnswered = issue.reporter_role === role ? theyAnswered : iAnswered;
  const step = issue.status === 'agreed' ? 4 : proposals.length > 1 || (sideAnswered && proposals.length > 0) ? 3 : sideAnswered ? 2 : 1;
  const sides = new Set(events.filter((e) => e.kind === 'proposal' || e.kind === 'note').map((e) => e.side));
  const canAsk = open && !issue.escalated_at && (late || sides.size >= 2);
  const rec = events.filter((e) => e.kind === 'recommendation').pop();

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 90 }}>
      <Link href={`${base}/issues`} className="small" style={{ fontWeight: 700 }}>‹ Problems</Link>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <h1 style={{ margin: 0 }}>{categoryLabel(issue.category)}</h1>
        <span className={`pill ${issue.status === 'agreed' ? 'ok' : open ? 'warn' : ''}`}>{issue.status === 'agreed' ? 'Settled' : open ? 'Open' : 'Withdrawn'}</span>
      </div>
      {searchParams.ok ? <div className="box ok" role="status">{searchParams.ok}</div> : null}
      {searchParams.error ? <div className="box warn" role="alert">{searchParams.error}</div> : null}

      <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 4 }} aria-label="Progress">
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4].map((n) => <i key={n} style={{ flex: 1, height: 6, borderRadius: 99, background: n < step || issue.status === 'agreed' ? 'var(--ok, #1f4d3a)' : n === step ? 'var(--brand)' : 'var(--line)' }} />)}
        </div>
        <span className="muted small">Reported · Answered · Agree on a fix · Settled{open && !late && !sideAnswered && issue.reporter_role !== role ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left to answer` : ''}</span>
      </div>

      {issue.status === 'agreed' && (
        <div className="box ok"><b>Settled{issue.agreed_at ? ` ${day(issue.agreed_at)}` : ''}.</b> Agreed fix: {issue.agreed_summary}. It is saved in the project <Link href={`${base}`} style={{ fontWeight: 700 }}>messages</Link>.</div>
      )}

      <section className="card" aria-label="What was reported">
        <div className="muted small">{reporterName === 'You' ? 'You say' : `${reporterName} says`}</div>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{issue.description}</p>
        {issue.wants ? <span className="muted small">Would like: {FIXES.find((f) => f[0] === issue.wants)?.[1]?.toLowerCase()}</span> : null}
        {iphotos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {iphotos.map((p) => purls.get(p.path) ? (
              <div key={p.id} style={{ position: 'relative' }}>
                <a href={purls.get(p.path)} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={purls.get(p.path)} alt={`Photo from ${nameOf(p.side)}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                </a>
                <span className="muted small" style={{ display: 'block' }}>{nameOf(p.side)}</span>
                {open && p.uploaded_by === user.id && (
                  <form action={deleteIssuePhoto} style={{ position: 'absolute', top: 4, right: 4 }}>
                    <input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="issue_id" value={issue.id} /><input type="hidden" name="photo_id" value={p.id} />
                    <button aria-label="Remove this photo" style={{ background: 'rgba(27,26,24,.7)', color: '#fff', border: 0, borderRadius: 99, width: 26, height: 26, cursor: 'pointer' }}>×</button>
                  </form>
                )}
              </div>
            ) : null)}
          </div>
        )}
        {open && <IssuePhotoAdder projectId={project.id} issueId={issue.id} />}
      </section>

      <section className="card" aria-label="What is on record">
        <h2>What is on record</h2>
        <p className="muted small" style={{ margin: 0 }}>Both sides see this same page.</p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>{agr?.executed_at ? `Agreement signed ${day(agr.executed_at as string)}, total ${dollars(t.total)}` : 'Agreement not signed by both sides yet'}</li>
          <li>{approvedCos} approved change order{approvedCos === 1 ? '' : 's'}</li>
          <li>Payments confirmed: {dollars(confirmed)} of {dollars(t.total)}</li>
          <li>{iphotos.length} photo{iphotos.length === 1 ? '' : 's'} on this problem, {(photoRows ?? []).length} on the project (<Link href={`${base}/photos`} style={{ fontWeight: 700 }}>see them</Link>)</li>
        </ul>
        <div className="lab" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Timeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '2px solid var(--line)', paddingLeft: 12 }}>
          {events.map((e) => (
            <div key={e.id} className="small" style={{ lineHeight: 1.4 }}>
              <b>{day(e.created_at)} · {nameOf(e.side)}</b>{' '}
              {e.kind === 'report' ? 'reported the problem' : e.kind === 'proposal' ? `proposed: ${describeFix(e)}` : e.kind === 'accept' ? `accepted: ${e.body}` : e.kind === 'note' ? 'sees it differently' : e.kind === 'recommendation' ? 'sent a recommendation' : e.kind === 'withdraw' ? 'withdrew it' : 'asked Jobfile to look'}
              {(e.kind === 'proposal' || e.kind === 'note') && e.body ? <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>&ldquo;{e.body}&rdquo;</div> : null}
            </div>
          ))}
        </div>
      </section>

      {rec && (
        <section className="card" style={{ background: 'var(--surface-2)' }} aria-label="Jobfile recommendation">
          <b>Jobfile&rsquo;s recommendation</b>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{rec.body}</p>
          <span className="muted small">This is a recommendation, not a ruling. It only applies if you both accept it.</span>
        </section>
      )}

      {open && theirLatest && (
        <section className="card" aria-label="Proposal to accept">
          <b>{otherName} proposed: {describeFix(theirLatest)}</b>
          {theirLatest.body ? <p className="muted" style={{ margin: 0 }}>&ldquo;{theirLatest.body}&rdquo;</p> : null}
          <form action={acceptFix}>
            <input type="hidden" name="project_id" value={project.id} />
            <input type="hidden" name="issue_id" value={issue.id} />
            <input type="hidden" name="event_id" value={theirLatest.id} />
            <button className="btn" type="submit">Accept this fix</button>
          </form>
          <span className="muted small">Or send your own answer below.</span>
        </section>
      )}

      {open && issue.ai_options && issue.ai_options.length > 0 && (
        <section className="card" style={{ background: '#eef2f9', borderColor: '#cfd9ec', color: '#1b1a18' }} aria-label="Suggestions">
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#2f5f8a' }}>Suggestions, not a decision</span>
          {issue.ai_options.map((o, n) => <p key={n} style={{ margin: 0 }}><b>{n + 1}.</b> {o}</p>)}
          <span className="small" style={{ color: '#6b655e' }}>Written by AI from the report. Either side can ignore them.</span>
        </section>
      )}

      {open && (
        <form action={proposeFix} className="card stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="Your answer">
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="issue_id" value={issue.id} />
          <h2>{iAnswered ? 'Send another answer' : 'Your answer'}</h2>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FIXES.map(([k, l, hint], n) => (
              <label key={k} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 10 }}>
                <input type="radio" name="fix" value={k} defaultChecked={n === 0} />
                <span><b>{l}</b><span className="muted small" style={{ display: 'block' }}>{hint}</span></span>
              </label>
            ))}
          </fieldset>
          <div className="grid2">
            <label className="fld">Amount (credit, balance or price)<input name="amount" inputMode="decimal" placeholder="$150" /></label>
            <label className="fld">Redo by (for redo)<input name="on_date" type="date" /></label>
          </div>
          <label className="fld">Note (needed if you see it differently)<textarea name="body" rows={3} maxLength={1500} /></label>
          <button className="btn" type="submit">Send my answer</button>
        </form>
      )}

      {open && (
        <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {issue.escalated_at ? (
            <p className="muted small" style={{ margin: 0 }}>Jobfile was asked to look{issue.mediator_sent_at ? ' and sent a recommendation' : '. A mediator will read the record and send a recommendation'}.</p>
          ) : canAsk ? (
            <form action={askJobfile}><input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="issue_id" value={issue.id} /><button className="btn ghost" type="submit">Ask Jobfile to look at this</button></form>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>Stuck after {RESPOND_DAYS} days or after you have both answered? You can ask Jobfile to look.</p>
          )}
          {issue.reporter_id === user.id && (
            <details className="wd"><summary>Withdraw this report</summary>
              <form action={withdrawIssue} className="stack" style={{ gap: 8 }}>
                <input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="issue_id" value={issue.id} />
                <p className="muted small" style={{ margin: 0 }}>{otherName} is told you withdrew it.</p>
                <div className="row"><button className="btn ghost" type="submit">Yes, withdraw</button></div>
              </form>
            </details>
          )}
        </div>
      )}
      <p className="muted small">Jobfile does not hold money, give legal advice or decide who is right. Nothing here is binding unless you both accept a fix. If you still disagree, community dispute resolution centers and your state&rsquo;s consumer complaint office can help.</p>
    </div>
  );
}
