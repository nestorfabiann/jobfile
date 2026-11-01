import { loadProject } from '@/lib/project';
import { dollars, signedDollars } from '@/lib/money';
import { milestoneAmounts, totals, type ChangeOrder, type Item, type Milestone } from '@/lib/agreement';
import { cancelRequest, confirmReceived, markPaid, reopenPayment, requestPayment } from './actions';

const TZ = 'America/Chicago';
const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const METHOD: Record<string, string> = { check: 'check', cash: 'cash', ach: 'ACH / bank transfer', card: 'card', other: 'other means' };

type Row = Milestone & {
  pay_status: 'scheduled' | 'requested' | 'paid' | 'confirmed';
  requested_at: string | null;
  paid_at: string | null;
  paid_method: string | null;
  confirmed_at: string | null;
  lien_waiver: boolean;
};

export default async function Payments({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const { sb, project, role } = await loadProject(params.id);

  const [{ data: agr }, { data: itemRows }, { data: msRows }, { data: coRows }] = await Promise.all([
    sb.from('agreements').select('executed_at').eq('project_id', project.id).maybeSingle(),
    sb.from('agreement_items').select('price_cents').eq('project_id', project.id),
    sb.from('agreement_milestones').select('*').eq('project_id', project.id).order('position'),
    sb.from('change_orders').select('*').eq('project_id', project.id),
  ]);

  const executed = !!agr?.executed_at;
  const ms = ((msRows ?? []) as Row[]).map((m) => ({ ...m, pct: Number(m.pct) }));
  const t = totals((itemRows ?? []) as Item[], (coRows ?? []) as ChangeOrder[]);
  const due = milestoneAmounts(t.base, ms);

  const sum = (f: (m: Row) => boolean) => ms.reduce((s, m, i) => (f(m) ? s + due[i] : s), 0);
  const paid = sum((m) => m.pay_status === 'confirmed');
  const awaiting = sum((m) => m.pay_status === 'paid');
  const requested = sum((m) => m.pay_status === 'requested');
  const left = t.base - paid - awaiting;

  return (
    <>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      <div className="card">
        <h2>Payments</h2>
        <p className="muted small">
          The contractor requests each payment from the schedule, the homeowner marks it paid, and the contractor confirms it arrived.
          Jobfile is a record both sides can see. It does not move money.
        </p>
        {executed ? (
          <div className="tiles">
            <div className="tile strong"><span className="lbl">Contract total</span><b>{dollars(t.total)}</b></div>
            <div className="tile"><span className="lbl">Paid</span><b>{dollars(paid)}</b></div>
            <div className="tile"><span className="lbl">{awaiting ? 'Awaiting confirmation' : 'Requested'}</span><b>{dollars(awaiting || requested)}</b></div>
            <div className="tile"><span className="lbl">Scheduled balance</span><b>{dollars(Math.max(0, left))}</b></div>
          </div>
        ) : (
          <div className="box warn">The payment schedule opens once both sides have signed the agreement.</div>
        )}
        {executed && t.chg !== 0 && (
          <p className="muted small">
            Approved change orders ({signedDollars(t.chg)}) are in the contract total. The schedule below follows the agreed price, so agree
            with the other side when changes are billed.
          </p>
        )}
      </div>

      {executed && ms.length === 0 && <div className="card"><p className="muted">No payment schedule in the agreement.</p></div>}

      {executed &&
        ms.map((m, i) => {
          const pill =
            m.pay_status === 'confirmed' ? ['Paid', 'ok'] : m.pay_status === 'paid' ? ['Marked paid', 'warn'] : m.pay_status === 'requested' ? ['Requested', 'warn'] : ['Scheduled', ''];
          const parts: string[] = [];
          if (m.requested_at) parts.push(`Requested ${stamp(m.requested_at)}.`);
          if (m.paid_at) parts.push(`Paid ${stamp(m.paid_at)} by ${METHOD[m.paid_method ?? 'other']}.`);
          if (m.confirmed_at) parts.push(`Receipt confirmed ${stamp(m.confirmed_at)}.${m.lien_waiver ? ' Lien waiver provided.' : ' No lien waiver recorded.'}`);
          return (
            <article className={`card ms ${m.pay_status}`} key={m.id}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                  <span className="lbl">Milestone · {m.pct}%</span>
                  <h3>{m.label}</h3>
                </div>
                <div className="stack" style={{ alignItems: 'flex-end', gap: 6 }}>
                  <b className="amt">{dollars(due[i])}</b>
                  <span className={`pill ${pill[1]}`}>{pill[0]}</span>
                </div>
              </div>
              {parts.length > 0 && <p className="muted small">{parts.join(' ')}</p>}

              {role === 'contractor' && m.pay_status === 'scheduled' && (
                <form action={requestPayment} className="row">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="id" value={m.id} />
                  <button className="btn accent" type="submit">Request payment</button>
                </form>
              )}
              {role === 'contractor' && m.pay_status === 'requested' && (
                <form action={cancelRequest} className="row">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="id" value={m.id} />
                  <button className="btn ghost" type="submit">Cancel request</button>
                </form>
              )}
              {role === 'homeowner' && m.pay_status === 'requested' && (
                <form action={markPaid} className="row">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="id" value={m.id} />
                  <label className="fld" style={{ flex: '1 1 180px' }}>
                    How did you pay?
                    <select name="method" defaultValue="check">
                      <option value="check">Check</option>
                      <option value="ach">ACH / bank transfer</option>
                      <option value="card">Card</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <button className="btn accent" type="submit">Mark paid</button>
                </form>
              )}
              {role === 'contractor' && m.pay_status === 'paid' && (
                <form action={confirmReceived} className="stack">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="id" value={m.id} />
                  <label className="row" style={{ flexWrap: 'nowrap' }}>
                    <input type="checkbox" name="lien_waiver" />
                    <span>I gave the homeowner a lien waiver for this payment.</span>
                  </label>
                  <div className="row">
                    <button className="btn" type="submit">Confirm I received it</button>
                    <button className="btn ghost" formAction={reopenPayment} type="submit">Not received</button>
                  </div>
                </form>
              )}
              {role === 'homeowner' && m.pay_status === 'paid' && (
                <form action={reopenPayment} className="row">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="id" value={m.id} />
                  <span className="muted small">Waiting for the contractor to confirm.</span>
                  <button className="btn ghost" type="submit">Undo</button>
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
