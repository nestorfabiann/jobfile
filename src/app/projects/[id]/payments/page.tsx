import { loadProject } from '@/lib/project';
import { dollars, signedDollars } from '@/lib/money';
import { milestoneAmounts, totals, type ChangeOrder, type Item, type Milestone } from '@/lib/agreement';
import { decidePayment, recordPayment } from './actions';

const TZ = 'America/Chicago';
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

type Payment = {
  id: string;
  milestone_id: string | null;
  amount_cents: number;
  method: string;
  paid_on: string;
  note: string;
  recorded_role: 'contractor' | 'homeowner';
  status: 'recorded' | 'confirmed' | 'disputed';
};

const STATUS: Record<string, [string, string]> = {
  recorded: ['Needs confirmation', 'warn'],
  confirmed: ['Confirmed', 'ok'],
  disputed: ['Disputed', 'bad'],
};

export default async function Payments({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const { sb, project, role, contractorName, homeownerName } = await loadProject(params.id);

  const [{ data: agr }, { data: itemRows }, { data: msRows }, { data: coRows }, { data: payRows }] = await Promise.all([
    sb.from('agreements').select('executed_at').eq('project_id', project.id).maybeSingle(),
    sb.from('agreement_items').select('price_cents').eq('project_id', project.id),
    sb.from('agreement_milestones').select('*').eq('project_id', project.id).order('position'),
    sb.from('change_orders').select('*').eq('project_id', project.id),
    sb.from('payments').select('*').eq('project_id', project.id).order('paid_on', { ascending: false }).order('created_at', { ascending: false }),
  ]);

  const executed = !!agr?.executed_at;
  const items = (itemRows ?? []) as Item[];
  const ms = ((msRows ?? []) as Milestone[]).map((m) => ({ ...m, pct: Number(m.pct) }));
  const pays = ((payRows ?? []) as Payment[]).map((p) => ({ ...p, amount_cents: Number(p.amount_cents) }));
  const t = totals(items, (coRows ?? []) as ChangeOrder[]);
  const due = milestoneAmounts(t.base, ms);

  const counted = pays.filter((p) => p.status !== 'disputed');
  const confirmed = pays.filter((p) => p.status === 'confirmed').reduce((s, p) => s + p.amount_cents, 0);
  const pending = pays.filter((p) => p.status === 'recorded').reduce((s, p) => s + p.amount_cents, 0);
  const balance = t.total - confirmed - pending;
  const paidFor = (id: string) => counted.filter((p) => p.milestone_id === id).reduce((s, p) => s + p.amount_cents, 0);
  const msLabel = (id: string | null) => ms.find((m) => m.id === id)?.label ?? 'Other';
  const nameOf = (r: string) => (r === 'contractor' ? contractorName : homeownerName);

  return (
    <>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      <div className="card">
        <h2>Payments</h2>
        <p className="muted small">
          This is a record both sides can see. Jobfile does not move money. Whoever pays or receives records it, and the other side
          confirms.
        </p>
        {executed ? (
          <div className="tiles">
            <div className="tile"><span className="lbl">Contract total</span><b>{dollars(t.total)}</b></div>
            <div className="tile"><span className="lbl">Confirmed paid</span><b>{dollars(confirmed)}</b></div>
            <div className="tile"><span className="lbl">Awaiting confirmation</span><b>{dollars(pending)}</b></div>
            <div className="tile"><span className="lbl">Balance</span><b>{dollars(Math.max(0, balance))}</b></div>
          </div>
        ) : (
          <div className="box warn">Payments open once both sides have signed the agreement.</div>
        )}
      </div>

      {executed && ms.length > 0 && (
        <div className="card">
          <h3>Payment schedule</h3>
          <div className="xs">
            <table className="tbl">
              <thead><tr><th>Milestone</th><th className="r">Due</th><th className="r">Recorded</th><th>Status</th></tr></thead>
              <tbody>
                {ms.map((m, i) => {
                  const paid = paidFor(m.id);
                  const state = paid >= due[i] && due[i] > 0 ? ['Paid', 'ok'] : paid > 0 ? ['Partial', 'warn'] : ['Upcoming', ''];
                  return (
                    <tr key={m.id}>
                      <td>{m.label} <span className="muted small">({m.pct}%)</span></td>
                      <td className="r">{dollars(due[i])}</td>
                      <td className="r">{dollars(paid)}</td>
                      <td><span className={`pill ${state[1]}`}>{state[0]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {t.chg !== 0 && (
            <p className="muted small">
              Approved change orders ({signedDollars(t.chg)}) are in the contract total above. Agree with the other side when they are billed.
            </p>
          )}
        </div>
      )}

      {executed && (
        <details className="card">
          <summary>Record a payment</summary>
          <form action={recordPayment} className="stack" style={{ marginTop: 10 }}>
            <input type="hidden" name="project_id" value={project.id} />
            <div className="grid2">
              <label className="fld">
                Milestone
                <select name="milestone_id" defaultValue="">
                  <option value="">Other / not a milestone</option>
                  {ms.map((m, i) => (
                    <option key={m.id} value={m.id}>{m.label} ({dollars(due[i])})</option>
                  ))}
                </select>
              </label>
              <label className="fld">
                Amount (USD)
                <input name="amount" inputMode="decimal" required placeholder="5000" />
              </label>
              <label className="fld">
                Method
                <select name="method" defaultValue="check">
                  <option value="check">Check</option>
                  <option value="ach">Bank transfer</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="fld">
                Date
                <input name="paid_on" type="date" required defaultValue={today()} />
              </label>
            </div>
            <label className="fld">
              Note (optional)
              <input name="note" maxLength={500} placeholder="Check #1042" />
            </label>
            <div className="row"><button className="btn" type="submit">Save payment</button></div>
          </form>
        </details>
      )}

      {executed && pays.length === 0 && <div className="card"><p className="muted">No payments recorded yet.</p></div>}

      {pays.map((p) => {
        const [label, tone] = STATUS[p.status];
        const mine = p.recorded_role === role;
        return (
          <article className="card" key={p.id}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stack" style={{ gap: 3 }}>
                <span className="lbl">{day(p.paid_on)} · {msLabel(p.milestone_id)} · {p.method}</span>
                <h3>{dollars(p.amount_cents)}</h3>
              </div>
              <span className={`pill ${tone}`}>{label}</span>
            </div>
            <p className="muted small">Recorded by {mine ? 'you' : nameOf(p.recorded_role)}{p.note ? ` · ${p.note}` : ''}</p>
            {p.status !== 'confirmed' && (
              <form action={decidePayment} className="row">
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="id" value={p.id} />
                {!mine && p.status === 'recorded' && (
                  <>
                    <button className="btn" name="decision" value="confirm">Confirm</button>
                    <button className="btn ghost" name="decision" value="dispute">Dispute</button>
                  </>
                )}
                {mine && <button className="btn ghost" name="decision" value="withdraw">Remove</button>}
              </form>
            )}
          </article>
        );
      })}

      <p className="muted small">
        Texas homeowners are advised to hold back 10% of payments during the work and for 30 days after completion, and to get a
        bills-paid affidavit and lien releases with the final payment. Ask your attorney how this applies to your job.
      </p>
    </>
  );
}
