import Link from 'next/link';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import AutoRefresh from '@/components/AutoRefresh';
import { dollars, signedDollars, daysText } from '@/lib/money';
import { totals, type ChangeOrder, type Item } from '@/lib/agreement';
import { setStage } from './actions';

const TZ = 'America/Chicago';
const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const STAGES = ['Agreement', 'Active', 'Closeout', 'Complete'];

export default async function Overview({ params }: { params: { id: string } }) {
  const { sb, user, project, role, contractorName, homeownerName } = await loadProject(params.id);
  const base = `/projects/${project.id}`;
  const other = role === 'contractor' ? 'homeowner' : 'contractor';

  const [{ data: agr }, { data: itemRows }, { data: sigRows }, { data: coRows }, { data: payRows }, { data: photoRows }, { data: msgRows }] =
    await Promise.all([
      sb.from('agreements').select('sent_at,executed_at,start_date,end_date').eq('project_id', project.id).maybeSingle(),
      sb.from('agreement_items').select('price_cents').eq('project_id', project.id),
      sb.from('agreement_signatures').select('role').eq('project_id', project.id),
      sb.from('change_orders').select('*').eq('project_id', project.id),
      sb.from('payments').select('amount_cents,status,recorded_role').eq('project_id', project.id),
      sb.from('photos').select('id,kind,status,path,caption,created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(200),
      sb.from('messages').select('sender_role,tag,created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(50),
    ]);

  const items = (itemRows ?? []) as Item[];
  const cos = (coRows ?? []) as ChangeOrder[];
  const t = totals(items, cos);
  const executed = !!agr?.executed_at;
  const signed = new Set((sigRows ?? []).map((s) => s.role as string));
  const pays = payRows ?? [];
  const confirmed = pays.filter((p) => p.status === 'confirmed').reduce((s, p) => s + Number(p.amount_cents), 0);
  const pending = pays.filter((p) => p.status === 'recorded').reduce((s, p) => s + Number(p.amount_cents), 0);
  const photos = photoRows ?? [];
  const fixes = photos.filter((p) => p.kind === 'fix');
  const openFixes = fixes.filter((p) => p.status === 'open').length;
  const awaitingConfirm = fixes.filter((p) => p.status === 'fixed').length;

  const stage = project.completed_at ? 3 : project.closeout_started_at ? 2 : executed ? 1 : 0;

  // What is waiting on this person.
  const todo: { text: string; href: string }[] = [];
  if (!executed) {
    if (role === 'contractor' && !agr?.sent_at) todo.push({ text: 'Finish the agreement and send it to the homeowner.', href: `${base}/agreement` });
    else if (agr?.sent_at && !signed.has(role)) todo.push({ text: 'Review and sign the agreement.', href: `${base}/agreement` });
    else if (agr?.sent_at && signed.has(role) && !signed.has(other)) todo.push({ text: 'Waiting for the other side to sign the agreement.', href: `${base}/agreement` });
  }
  cos.filter((c) => c.status === 'pending' && c.requested_role !== role).forEach((c) =>
    todo.push({ text: `Approve or decline CO-${c.number}: ${c.title} (${signedDollars(c.cost_cents)}).`, href: `${base}/changes` }),
  );
  pays.filter((p) => p.status === 'recorded' && p.recorded_role !== role).forEach((p) =>
    todo.push({ text: `Confirm a ${dollars(Number(p.amount_cents))} payment.`, href: `${base}/payments` }),
  );
  if (role === 'contractor' && openFixes) todo.push({ text: `${openFixes} detail${openFixes === 1 ? '' : 's'} to fix.`, href: `${base}/photos` });
  if (role === 'homeowner' && awaitingConfirm)
    todo.push({ text: `Check ${awaitingConfirm} fixed detail${awaitingConfirm === 1 ? '' : 's'} and confirm.`, href: `${base}/photos` });
  const msgs = msgRows ?? [];
  const lastQ = msgs.findIndex((m) => m.tag === 'question' && m.sender_role !== role);
  if (lastQ !== -1 && !msgs.slice(0, lastQ).some((m) => m.sender_role === role))
    todo.push({ text: 'Answer a question in Messages.', href: base });

  // Latest photos, with short-lived private links.
  const recent = photos.slice(0, 4);
  const urls = new Map<string, string>();
  if (recent.length) {
    const { data: signedUrls } = await supabaseAdmin().storage.from('project-photos').createSignedUrls(recent.map((p) => p.path as string), 3600);
    (signedUrls ?? []).forEach((s) => s.path && s.signedUrl && urls.set(s.path, s.signedUrl));
  }

  const pct = t.total > 0 ? Math.min(100, Math.round((confirmed / t.total) * 100)) : 0;
  const finish = agr?.end_date ? (t.days ? addDays(agr.end_date as string, t.days) : day(agr.end_date as string)) : null;

  return (
    <>
      <AutoRefresh seconds={30} />

      <section className="hero" aria-label="Project summary">
        <span className="lbl" style={{ color: 'rgba(255,255,255,.8)' }}>{project.address || 'No address yet'}</span>
        <h2 style={{ fontSize: 26 }}>{project.name}</h2>
        <p>{contractorName} · {homeownerName}</p>
      </section>

      <ol className="stages" aria-label="Project stage">
        {STAGES.map((s, i) => (
          <li key={s} className={i < stage ? 'done' : i === stage ? 'now' : ''} aria-current={i === stage ? 'step' : undefined}>
            <span />
            {s}
          </li>
        ))}
      </ol>

      <section className="card" aria-label="Needs your attention">
        <h2>Needs your attention</h2>
        {todo.length === 0 ? (
          <p className="muted">Nothing waiting on you.</p>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {todo.map((x, i) => (
              <li key={i} className="todo"><Link href={x.href}>{x.text}</Link></li>
            ))}
          </ul>
        )}
      </section>

      {executed ? (
        <section className="card" aria-label="Money">
          <h2>Money</h2>
          <div className="tiles">
            <div className="tile"><span className="lbl">Agreed price</span><b>{dollars(t.base)}</b></div>
            <div className="tile"><span className="lbl">Approved changes</span><b>{signedDollars(t.chg)}</b></div>
            <div className="tile strong"><span className="lbl">Contract total</span><b>{dollars(t.total)}</b></div>
            <div className="tile"><span className="lbl">Paid (confirmed)</span><b>{dollars(confirmed)}</b></div>
          </div>
          <div className="bar" role="img" aria-label={`${pct}% of the contract total paid`}><span style={{ width: `${pct}%` }} /></div>
          <p className="muted small">
            {pct}% paid{pending ? ` · ${dollars(pending)} waiting for confirmation` : ''} · <Link href={`${base}/payments`}>Payments</Link>
          </p>
        </section>
      ) : (
        <section className="card">
          <h2>Money</h2>
          <p className="muted">The price and payment schedule appear here once the agreement is signed by both sides.</p>
        </section>
      )}

      <section className="card" aria-label="Schedule">
        <h2>Schedule</h2>
        {agr?.start_date && agr?.end_date ? (
          <dl className="kv">
            <dt>Start</dt><dd>{day(agr.start_date as string)}</dd>
            <dt>Estimated finish</dt><dd>{finish}{t.days ? ` (${daysText(t.days)} from approved changes)` : ''}</dd>
          </dl>
        ) : (
          <p className="muted">Dates are set in the agreement.</p>
        )}
      </section>

      <section className="card" aria-label="Photos">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Photos</h2>
          <Link href={`${base}/photos`} className="small">See all ({photos.length})</Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted">No photos yet.</p>
        ) : (
          <div className="strip">
            {recent.map((p) => {
              const u = urls.get(p.path as string);
              return u ? (
                <Link key={p.id} href={`${base}/photos`} className="ph">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={(p.caption as string) || 'Project photo'} loading="lazy" />
                </Link>
              ) : null;
            })}
          </div>
        )}
        {fixes.length > 0 && <p className="muted small">{openFixes} open · {awaitingConfirm} waiting to be confirmed · {fixes.length - openFixes - awaitingConfirm} done</p>}
      </section>

      {role === 'contractor' && executed && (
        <section className="card" aria-label="Job stage">
          <h2>Job stage</h2>
          {!project.closeout_started_at && (
            <p className="muted small">Start closeout when the work is substantially done: final walkthrough, punch list, final payment.</p>
          )}
          {project.closeout_started_at && !project.completed_at && (
            <p className="muted small">
              Before marking complete: finish the punch list, record the final payment, and for Texas jobs get the bills-paid affidavit and
              lien releases (not tracked in Jobfile yet).
            </p>
          )}
          <form action={setStage} className="row">
            <input type="hidden" name="project_id" value={project.id} />
            {!project.closeout_started_at && <button className="btn" name="to" value="closeout">Start closeout</button>}
            {project.closeout_started_at && !project.completed_at && <button className="btn accent" name="to" value="complete">Mark complete</button>}
            {(project.closeout_started_at || project.completed_at) && <button className="btn ghost" name="to" value="reopen">Move back to active</button>}
          </form>
        </section>
      )}
    </>
  );
}
