import { loadProject } from '@/lib/project';
import { dollars, signedDollars, daysText } from '@/lib/money';
import { totals, type ChangeOrder, type Item } from '@/lib/agreement';
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

  const [{ data: agr }, { data: itemRows }, { data: coRows }] = await Promise.all([
    sb.from('agreements').select('executed_at').eq('project_id', project.id).maybeSingle(),
    sb.from('agreement_items').select('price_cents').eq('project_id', project.id),
    sb.from('change_orders').select('*').eq('project_id', project.id).order('number', { ascending: false }),
  ]);
  const changes = (coRows ?? []) as ChangeOrder[];
  const t = totals((itemRows ?? []) as Item[], changes);
  const executed = !!agr?.executed_at;
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
        <details className="card">
          <summary>New change order</summary>
          <form action={createChangeOrder} className="stack" style={{ marginTop: 10 }}>
            <input type="hidden" name="project_id" value={project.id} />
            <label className="fld">Title<input name="title" required placeholder="Move range outlet" /></label>
            <label className="fld">
              What changes
              <textarea name="description" rows={3} placeholder="Describe the work, materials and where." />
            </label>
            <div className="grid2">
              <label className="fld">
                Price change (USD, negative for a credit)
                <input name="cost" inputMode="decimal" placeholder="0" />
              </label>
              <label className="fld">
                Schedule change (days)
                <input name="days" inputMode="numeric" placeholder="0" />
              </label>
            </div>
            <div className="row"><button className="btn" type="submit">Send for approval</button></div>
          </form>
        </details>
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
