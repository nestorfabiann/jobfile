import Link from 'next/link';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars, signedDollars } from '@/lib/money';
import { milestoneAmounts, totals, type ChangeOrder, type Item, type Milestone } from '@/lib/agreement';
import { loadConfirms } from '@/lib/closeout';
import { confirmCloseout } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Closeout checklist · Jobfile' };

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

export default async function Closeout({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const { sb, project, role, contractorName, homeownerName } = await loadProject(params.id);
  const base = `/projects/${project.id}`;
  const other = role === 'homeowner' ? 'contractor' : 'homeowner';
  const otherName = role === 'homeowner' ? contractorName : homeownerName;
  const [{ data: itemRows }, { data: coRows }, { data: msRows }, { data: photoRows }, { data: agr }] = await Promise.all([
    sb.from('agreement_items').select('*').eq('project_id', project.id).order('position'),
    sb.from('change_orders').select('*').eq('project_id', project.id).order('number'),
    sb.from('agreement_milestones').select('*').eq('project_id', project.id).order('position'),
    sb.from('photos').select('kind,status').eq('project_id', project.id),
    sb.from('agreements').select('executed_at').eq('project_id', project.id).maybeSingle(),
  ]);
  const items = ((itemRows ?? []) as Item[]).filter((i) => i.kind === 'work');
  const allItems = (itemRows ?? []) as Item[];
  const cos = (coRows ?? []) as ChangeOrder[];
  const t = totals(allItems, cos);
  const pms = ((msRows ?? []) as (Milestone & { pay_status: string })[]).map((m) => ({ ...m, pct: Number(m.pct) }));
  const amts = milestoneAmounts(t.base, pms);
  const coBill = (cos as any[]).filter((c) => c.status === 'approved' && c.cost_cents > 0);
  const sumBy = (st: string) => pms.reduce((s, m, i) => (m.pay_status === st ? s + amts[i] : s), 0) + coBill.reduce((s, c) => ((c.pay_status ?? 'scheduled') === st ? s + c.cost_cents : s), 0);
  const confirmed = sumBy('confirmed');
  const waiting = sumBy('paid');
  const left = Math.max(0, t.total - confirmed);
  const fixes = (photoRows ?? []).filter((p: any) => p.kind === 'fix');
  const openFixes = fixes.filter((p: any) => p.status === 'open' || p.status === 'fixed').length;
  const pendingCos = (cos as any[]).filter((c) => c.status !== 'approved' && c.status !== 'declined' && c.status !== 'rejected' && c.status !== 'withdrawn');

  const doneOn = new Map<string, string>();
  try {
    const { data: st } = await supabaseAdmin().from('project_scope_status').select('ref_id,status,done_at').eq('project_id', project.id).eq('ref_kind', 'item');
    ((st ?? []) as any[]).forEach((r) => { if (r.status === 'done' && r.done_at) doneOn.set(r.ref_id, when(r.done_at)); });
  } catch { /* scope table not created yet */ }
  const cf = await loadConfirms(project.id);
  const mine = cf[role];
  const theirs = cf[other];
  const hoPaid = cf.homeowner?.homeowner_paid_cents ?? null;
  const diff = hoPaid != null ? hoPaid - confirmed : 0;
  const theirFlags = theirs ? Object.entries(theirs.scope).filter(([, v]) => v === 'not_done' || v === 'changed') : [];
  const titleOf = (id: string) => items.find((i) => i.id === id)?.title ?? 'a scope item';

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 90 }}>
      <Link href={`${base}/overview`} className="small" style={{ fontWeight: 700 }}>‹ {project.name}</Link>
      <h1>Before we close this out</h1>
      <p className="muted">Confirm your side. {otherName} confirms theirs. This never stops the job from being closed, and it is saved in the project record. Jobfile records payments only. It does not hold or move money.</p>
      {searchParams.ok ? <div className="box ok" role="status">Saved. Your side is confirmed.</div> : null}
      {searchParams.error ? <div className="box warn" role="alert">{searchParams.error}</div> : null}
      {!agr?.executed_at ? <div className="box warn">The agreement is not signed by both sides yet, so there is nothing to close out.</div> : null}

      <section className="card" aria-label="Status" style={{ gap: 6 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>You</span><span className={`pill${mine ? ' ok' : ''}`}>{mine ? `Confirmed ${when(mine.confirmed_at)}` : 'Not yet'}</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>{otherName}</span><span className={`pill${theirs ? ' ok' : ''}`}>{theirs ? `Confirmed ${when(theirs.confirmed_at)}` : 'Not yet'}</span></div>
        {theirFlags.length > 0 ? (
          <div className="box warn"><b>{otherName} flagged:</b> {theirFlags.map(([id, v]) => `${titleOf(id)} (${v === 'not_done' ? 'not done' : 'changed'})`).join(', ')}.</div>
        ) : null}
        {theirs?.note ? <p className="small muted" style={{ margin: 0 }}>{otherName}&rsquo;s note: &ldquo;{theirs.note}&rdquo;</p> : null}
      </section>

      <form action={confirmCloseout} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input type="hidden" name="project_id" value={project.id} />

        <section className="card" aria-label="Scope of work">
          <h2>1 · Scope of work</h2>
          {items.length === 0 ? <p className="muted">No work lines in the agreement.</p> : items.map((i) => {
            const cur = mine?.scope[i.id] ?? 'done';
            const alt = role === 'homeowner' ? ['not_done', 'Not done'] : ['changed', 'Changed'];
            return (
              <fieldset key={i.id} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <legend style={{ fontWeight: 700, padding: 0 }}>{i.title}</legend>
                <span className="muted small">{doneOn.has(i.id) ? `Marked done by the contractor ${doneOn.get(i.id)}` : 'Not marked done on the Overview yet'}</span>
                <div className="row" style={{ gap: 14 }}>
                  <label className="row small" style={{ gap: 6 }}><input type="radio" name={`s_${i.id}`} value="done" defaultChecked={cur === 'done'} /> Done</label>
                  <label className="row small" style={{ gap: 6 }}><input type="radio" name={`s_${i.id}`} value={alt[0]} defaultChecked={cur === alt[0]} /> {alt[1]}</label>
                </div>
              </fieldset>
            );
          })}
          <p className="muted small" style={{ margin: 0 }}>Anything marked {role === 'homeowner' ? '"Not done"' : '"Changed"'} goes to {otherName}. Add a note below, or use a change order for new work.</p>
        </section>

        <section className="card" aria-label="Extra work">
          <h2>2 · Extra work</h2>
          {cos.length === 0 ? <p className="muted" style={{ margin: 0 }}>No change orders.</p> : (
            <p style={{ margin: 0 }}>{cos.length} change order{cos.length === 1 ? '' : 's'}, approved changes {signedDollars(t.chg)}.</p>
          )}
          {pendingCos.length > 0 ? <div className="box warn">{pendingCos.length} change order{pendingCos.length === 1 ? ' is' : 's are'} still waiting. <Link href={`${base}/changes`}>Open Changes</Link></div> : <p className="small muted" style={{ margin: 0 }}>All extra work is settled.</p>}
        </section>

        <section className="card" aria-label="Payments">
          <h2>3 · Payments</h2>
          <dl className="kv">
            <dt>Agreed plus approved changes</dt><dd>{dollars(t.total)}</dd>
            <dt>{role === 'contractor' ? 'Recorded received' : 'Recorded as paid'}</dt><dd>{dollars(confirmed)}</dd>
            {waiting > 0 ? (<><dt>Waiting for confirmation</dt><dd>{dollars(waiting)}</dd></>) : null}
            <dt>Still to pay</dt><dd>{dollars(left)}</dd>
          </dl>
          {role === 'homeowner' ? (
            <>
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <legend style={{ fontWeight: 700, padding: 0 }}>Is there anything you paid that is not listed?</legend>
                <label className="row small" style={{ gap: 6 }}><input type="radio" name="paid_choice" value="all" defaultChecked={mine?.homeowner_paid_cents == null} /> That is all I paid</label>
                <label className="row small" style={{ gap: 6 }}><input type="radio" name="paid_choice" value="more" defaultChecked={mine?.homeowner_paid_cents != null} /> I paid more</label>
              </fieldset>
              <label htmlFor="pt" className="small">If you paid more, the total you have paid so far</label>
              <input id="pt" name="paid_total" inputMode="decimal" placeholder="3001.60" defaultValue={mine?.homeowner_paid_cents != null ? (mine.homeowner_paid_cents / 100).toFixed(2) : ''} />
            </>
          ) : (
            <>
              <p className="small muted" style={{ margin: 0 }}>Got paid in cash or by check that is not recorded? Record it so My money is right.</p>
              <Link className="btn ghost" href={`${base}/payments`}>Open Payments to record it</Link>
              {hoPaid != null && diff > 0 ? (
                <div className="box warn">
                  <b>{homeownerName} says they have paid {dollars(hoPaid)}.</b> You have {dollars(confirmed)} recorded, a difference of {dollars(diff)}.
                  <fieldset style={{ border: 0, padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <legend style={{ fontWeight: 700, padding: 0 }}>Did you receive the difference?</legend>
                    <label className="row small" style={{ gap: 6 }}><input type="radio" name="payment_answer" value="received" defaultChecked={mine?.payment_answer === 'received'} /> Yes. I will record it in Payments.</label>
                    <label className="row small" style={{ gap: 6 }}><input type="radio" name="payment_answer" value="not_received" defaultChecked={mine?.payment_answer === 'not_received'} /> No, I did not receive it</label>
                  </fieldset>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="card" aria-label="Punch list">
          <h2>4 · Punch list and photos</h2>
          {openFixes === 0 ? <p style={{ margin: 0 }}>No open punch-list items.</p> : <div className="box warn">{openFixes} punch-list item{openFixes === 1 ? '' : 's'} still open. <Link href={`${base}/photos`}>Open Photos</Link></div>}
          <p className="small muted" style={{ margin: 0 }}>Final photos help the project record. <Link href={`${base}/photos`}>Add photos</Link></p>
        </section>

        <section className="card" aria-label="Note">
          <h2>5 · Anything else?</h2>
          <textarea name="note" rows={3} maxLength={500} defaultValue={mine?.note ?? ''} placeholder="Optional. For example: check #1042 on Nov 3." />
        </section>

        <button className="btn" type="submit" disabled={!agr?.executed_at}>{mine ? 'Update my confirmation' : 'Confirm my side'}</button>
      </form>
    </div>
  );
}
