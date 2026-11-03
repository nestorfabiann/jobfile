import Link from 'next/link';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import AutoRefresh from '@/components/AutoRefresh';
import KitchenArt from '@/components/KitchenArt';
import { dollars, signedDollars, daysText } from '@/lib/money';
import { milestoneAmounts, totals, type ChangeOrder, type Item, type Milestone } from '@/lib/agreement';
import { setStage, requestFinish } from './actions';
import FinishCard from '@/components/FinishCard';

const TZ = 'America/Chicago';
const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const STAGES = ['Agreement', 'Active', 'Closeout', 'Complete'];

export default async function Overview({ params, searchParams }: { params: { id: string }; searchParams: { hired?: string } }) {
  const { sb, user, project, role, contractorName, homeownerName } = await loadProject(params.id);
  const base = `/projects/${project.id}`;
  const other = role === 'contractor' ? 'homeowner' : 'contractor';

  const [{ data: agr }, { data: itemRows }, { data: sigRows }, { data: coRows }, { data: msRows2 }, { data: photoRows }, { data: msgRows }] =
    await Promise.all([
      sb.from('agreements').select('sent_at,executed_at,start_date,end_date').eq('project_id', project.id).maybeSingle(),
      sb.from('agreement_items').select('price_cents').eq('project_id', project.id),
      sb.from('agreement_signatures').select('role').eq('project_id', project.id),
      sb.from('change_orders').select('*').eq('project_id', project.id),
      sb.from('agreement_milestones').select('id,position,label,pct,pay_status').eq('project_id', project.id).order('position'),
      sb.from('photos').select('id,kind,status,path,caption,created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(200),
      sb.from('messages').select('sender_role,tag,created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(50),
    ]);

  const items = (itemRows ?? []) as Item[];
  const cos = (coRows ?? []) as ChangeOrder[];
  const t = totals(items, cos);
  const executed = !!agr?.executed_at;
  const signed = new Set((sigRows ?? []).map((s) => s.role as string));
  const pms = ((msRows2 ?? []) as (Milestone & { pay_status: string })[]).map((m) => ({ ...m, pct: Number(m.pct) }));
  const dueAmts = milestoneAmounts(t.base, pms);
  const sumBy = (st: string) => pms.reduce((s, m, i) => (m.pay_status === st ? s + dueAmts[i] : s), 0);
  const confirmed = sumBy('confirmed');
  const pending = sumBy('paid');
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
  pms.forEach((m, i) => {
    if (role === 'homeowner' && m.pay_status === 'requested')
      todo.push({ text: `Payment requested: ${m.label} (${dollars(dueAmts[i])}).`, href: `${base}/payments` });
    if (role === 'contractor' && m.pay_status === 'paid')
      todo.push({ text: `Confirm you received ${dollars(dueAmts[i])} for ${m.label}.`, href: `${base}/payments` });
  });
  if (role === 'contractor' && openFixes) todo.push({ text: `${openFixes} detail${openFixes === 1 ? '' : 's'} to fix.`, href: `${base}/photos` });
  if (role === 'homeowner' && awaitingConfirm)
    todo.push({ text: `Check ${awaitingConfirm} fixed detail${awaitingConfirm === 1 ? '' : 's'} and confirm.`, href: `${base}/photos` });
  const msgs = msgRows ?? [];
  const lastQ = msgs.findIndex((m) => m.tag === 'question' && m.sender_role !== role);
  if (lastQ !== -1 && !msgs.slice(0, lastQ).some((m) => m.sender_role === role))
    todo.push({ text: 'Answer a question in Messages.', href: base });

  // After completion, ask each side to rate until they have.
  if (project.completed_at) {
    const { data: myReview } = await sb.from('reviews').select('id').eq('project_id', project.id).eq('reviewer_role', role).maybeSingle();
    if (!myReview)
      todo.unshift({
        text: `Project complete. Rate your experience with ${role === 'homeowner' ? contractorName : homeownerName}.`,
        href: `${base}/rating`,
      });
  }

  // Latest photos, with short-lived private links.
  const recent = photos.slice(0, 4);
  const urls = new Map<string, string>();
  if (recent.length) {
    const { data: signedUrls } = await supabaseAdmin().storage.from('project-photos').createSignedUrls(recent.map((p) => p.path as string), 3600);
    (signedUrls ?? []).forEach((s) => s.path && s.signedUrl && urls.set(s.path, s.signedUrl));
  }

  const allPaid = pms.length === 0 || pms.every((m) => m.pay_status === 'confirmed');
  const checks = [
    { ok: allPaid, text: allPaid ? 'Final payment confirmed received' : 'Some payments are not confirmed yet' },
    { ok: openFixes === 0 && awaitingConfirm === 0, text: openFixes === 0 && awaitingConfirm === 0 ? 'No open punch-list items' : `${openFixes + awaitingConfirm} punch-list item${openFixes + awaitingConfirm === 1 ? '' : 's'} still open` },
  ];
  let asked = false;
  if (executed && role === 'homeowner' && !project.completed_at) {
    const { count } = await supabaseAdmin().from('notifications').select('id', { count: 'exact', head: true }).eq('project_id', project.id).eq('kind', 'finish_request').gt('created_at', new Date(Date.now() - 86400000).toISOString());
    asked = (count ?? 0) > 0;
  }
  const pct = t.total > 0 ? Math.min(100, Math.round((confirmed / t.total) * 100)) : 0;
  const finish = agr?.end_date ? (t.days ? addDays(agr.end_date as string, t.days) : day(agr.end_date as string)) : null;

  return (
    <>
      <AutoRefresh seconds={30} />

      <section className="hero" aria-label="Project summary">
        <KitchenArt size={56} />
        <span className="lbl" style={{ color: 'rgba(255,255,255,.8)' }}>{project.address || 'No address yet'}</span>
        <h2 style={{ fontSize: 26 }}>{project.name}</h2>
        <p>{role === 'homeowner' ? <Link href={`/contractors/${project.company_id}`} style={{ color: 'inherit' }}>{contractorName}</Link> : contractorName} · {homeownerName}</p>
      </section>

      {role === 'homeowner' && searchParams.hired === '1' && (
        <section className="card why" aria-label="What happens next">
          <span className="pill ok" style={{ width: 'max-content' }}>You hired {contractorName}</span>
          <h2 style={{ fontSize: 22 }}>What happens next</h2>
          <ol className="stack" style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li><b>{contractorName} reviews the agreement.</b> The scope and price are already filled in. They send it to you.</li>
            <li><b>You read it and sign.</b> Then they sign, and the job is official.</li>
            <li><b>{agr?.start_date ? `Work starts ${day(agr.start_date as string)}.` : 'Work starts on the date you agree.'}</b> Photos, payments and changes all stay in this project.</li>
          </ol>
          <div className="row">
            <Link className="btn ghost" href={`${base}/agreement`}>Open the agreement</Link>
            <Link className="btn ghost" href={base}>Message {contractorName}</Link>
          </div>
        </section>
      )}

      <ol className="stages" aria-label="Project stage">
        {STAGES.map((s, i) => (
          <li key={s} className={i < stage ? 'done' : i === stage ? 'now' : ''} aria-current={i === stage ? 'step' : undefined}>
            <span />
            {s}
          </li>
        ))}
      </ol>

      {executed && (
        <FinishCard
          role={role}
          projectId={project.id}
          completed={!!project.completed_at}
          closeoutStarted={!!project.closeout_started_at}
          checks={checks}
          otherName={role === 'contractor' ? homeownerName : contractorName}
          asked={asked}
          setStage={setStage}
          requestFinish={requestFinish}
        />
      )}

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
            <div className="tile"><span className="lbl">Paid</span><b>{dollars(confirmed)}</b></div>
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

    </>
  );
}
