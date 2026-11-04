import { loadProject } from '@/lib/project';
import { dollars, signedDollars, daysText } from '@/lib/money';
import { creditRoom, milestoneAmounts, totals, type ChangeOrder, type Item, type Milestone } from '@/lib/agreement';
import ChangeOrderForm from '@/components/ChangeOrderForm';
import { createChangeOrder, decideChange } from './actions';

const TZ = 'America/Chicago';
const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const STATUS: Record<string, [string, string]> = {
  pending: ['Pending', 'warn'],
  approved: ['Approved', 'ok'],
  declined: ['Declined', 'bad'],
  withdrawn: ['Withdrawn', ''],
};

export default async function Changes({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const { sb, project, role, contractorName, homeownerName } = await loadProject(params.id);

  const [{ data: agr }, { data: itemRows }, { data: coRows }, { data: msRows }] = await Promise.all([
    sb.from('agreements').select('executed_at').eq('project_id', project.id).maybeSingle(),
    sb.from('agreement_items').select('price_cents').eq('project_id', project.id),
    sb.from('change_orders').select('*').eq('project_id', project.id).order('number', { ascending: false }),
    sb.from('agreement_milestones').select('*').eq('project_id', project.id).order('position'),
  ]);
  const changes = (coRows ?? []) as ChangeOrder[];
  const t = totals((itemRows ?? []) as Item[], changes);
  const executed = !!agr?.executed_at;
  // For the credit hint: what is left to reduce, and the final payment as it stands now.
  const sched = ((msRows ?? []) as any[]).map((m) => ({ ...m, pct: Number(m.pct) })) as Milestone[];
  const amts = milestoneAmounts(t.base, sched);
  const roomCents = creditRoom(t.base, sched);
  const last = sched.length - 1;
  const finalCents = last >= 0 && (sched[last].pay_status ?? 'scheduled') === 'scheduled' ? amts[last] : 0;
  const nameOf = (r: string) => (r === 'contractor' ? contractorName : homeownerName);

  return (
    <>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      <div className="card">
        <h2>Change orders</h2>
        <p className="muted small">
          Anything that changes price, materials or schedule is written here first. Extra work starts only after the other side approves.
        </p>
        {executed && (
          <dl className="kv">
            <dt>Agreed price</dt><dd>{dollars(t.base)}</dd>
            <dt>Approved changes</dt><dd>{signedDollars(t.chg)} · {daysText(t.days)}</dd>
            <dt>Contract total</dt><dd><b>{dollars(t.total)}</b></dd>
          </dl>
        )}
      </div>

      {!executed ? (
        <div className="box warn">Change orders open once both sides have signed the agreement. Until then, edit the agreement directly.</div>
      ) : (
        <>
        <details className="conew">
          <summary className="btn accent">New change order</summary>
          <ChangeOrderForm action={createChangeOrder} projectId={project.id} finalCents={finalCents} roomCents={roomCents} />
        </details>
        <p className="muted small conew-hint">Extra work, new materials or a schedule change. The other side approves before it starts.</p>
        </>
      )}

      {executed && changes.length === 0 && (
        <div className="card"><p className="muted">No change orders yet.</p></div>
      )}

      {changes.map((c) => {
        const [label, tone] = STATUS[c.status];
        const mine = c.requested_role === role;
        return (
          <article className="card" key={c.id}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stack" style={{ gap: 3 }}>
                <span className="lbl">CO-{c.number} · {nameOf(c.requested_role)} · {stamp(c.created_at)}</span>
                <h3>{c.title}</h3>
              </div>
              <span className={`pill ${tone}`}>{label}</span>
            </div>
            {c.description ? <p style={{ whiteSpace: 'pre-wrap' }}>{c.description}</p> : null}
            <div className="row">
              <b>{signedDollars(c.cost_cents)}</b>
              <span className="muted">{daysText(c.days)}</span>
            </div>
            {c.decided_at ? <p className="muted small">{label} · {stamp(c.decided_at)}</p> : null}
            {c.status === 'pending' && !mine && c.cost_cents > 0 && (
              <div className="box ok"><b>If you approve:</b> this becomes its own payment line, CO-{c.number}: {c.title}, {dollars(c.cost_cents)}. The contract total goes up by {dollars(c.cost_cents)}. Nothing is due until the work is done and the contractor requests the payment.</div>
            )}
            {c.status === 'pending' && !mine && c.cost_cents < 0 && (
              <div className="box ok"><b>If you approve:</b> this is a credit of {dollars(-c.cost_cents)}. The contract total goes down by that amount. The credit comes off the last payments that have not been requested yet, starting with the final one.</div>
            )}
            {c.status === 'pending' && (
              <form action={decideChange} className="row">
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="id" value={c.id} />
                {mine ? (
                  <button className="btn ghost" name="decision" value="withdraw">Withdraw</button>
                ) : (
                  <>
                    <button className="btn" name="decision" value="approve">Approve</button>
                    <button className="btn ghost" name="decision" value="decline">Decline</button>
                  </>
                )}
              </form>
            )}
          </article>
        );
      })}
    </>
  );
}
