import { loadProject } from '@/lib/project';
import { dollars, centsToInput } from '@/lib/money';
import {
  STANDARD_TERMS,
  agreementIssues,
  milestoneAmounts,
  totals,
  type AgreementRow,
  type ChangeOrder,
  type Item,
  type Milestone,
  type Signature,
} from '@/lib/agreement';
import AgreementEditor from '@/components/AgreementEditor';
import { saveHomestead, sendAgreement, signAgreement, startAgreement } from './actions';

const TZ = 'America/Chicago';
const day = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function AgreementPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; edit?: string };
}) {
  const { sb, project, role, contractorName, homeownerName } = await loadProject(params.id);
  const error = searchParams.error ? <div className="box bad">{searchParams.error}</div> : null;

  // Row level security hides the draft from the homeowner until the contractor sends it.
  const { data: agr } = await sb.from('agreements').select('*').eq('project_id', project.id).maybeSingle();
  const a = agr as AgreementRow | null;

  if (!a) {
    return (
      <>
        {error}
        {role === 'contractor' ? (
          <form action={startAgreement} className="card">
            <h2>Start the agreement</h2>
            <p className="muted">
              List the scope and price, the schedule and the payment milestones. Nothing is visible to {homeownerName} until you send it.
            </p>
            <input type="hidden" name="project_id" value={project.id} />
            <div className="row"><button className="btn" type="submit">Start the agreement</button></div>
          </form>
        ) : (
          <div className="card">
            <h2>Agreement</h2>
            <p className="muted">{contractorName} is preparing the agreement. You will get an email when it is ready to review.</p>
          </div>
        )}
      </>
    );
  }

  const [{ data: itemRows }, { data: msRows }, { data: sigRows }, { data: coRows }] = await Promise.all([
    sb.from('agreement_items').select('*').eq('project_id', project.id).order('position'),
    sb.from('agreement_milestones').select('*').eq('project_id', project.id).order('position'),
    sb.from('agreement_signatures').select('role,typed_name,revision,signed_at').eq('project_id', project.id),
    sb.from('change_orders').select('*').eq('project_id', project.id).order('number'),
  ]);
  const items = (itemRows ?? []) as Item[];
  const ms = (msRows ?? []).map((m) => ({ ...m, pct: Number(m.pct) })) as Milestone[];
  const sigs = (sigRows ?? []) as Signature[];
  const changes = (coRows ?? []) as ChangeOrder[];

  const t = totals(items, changes);
  const amts = milestoneAmounts(t.base, ms);
  const issues = agreementIssues(a, items, ms);
  const executed = !!a.executed_at;
  const mySig = sigs.find((s) => s.role === role);
  const editing = role === 'contractor' && !executed && searchParams.edit === '1';
  const status = executed ? 'Fully signed' : a.sent_at ? (sigs.length ? 'Partly signed' : 'Sent for signature') : 'Draft';

  if (editing) {
    return (
      <>
        {error}
        <AgreementEditor
          projectId={project.id}
          hadSignatures={sigs.length > 0}
          items={items.map((i) => ({ title: i.title, kind: i.kind, price: centsToInput(i.price_cents), desc: i.description }))}
          milestones={ms.map((m) => ({ label: m.label, pct: String(m.pct) }))}
          terms={{
            start: a.start_date ?? '',
            end: a.end_date ?? '',
            hours: a.working_hours,
            permits: a.permits_by,
            warranty: a.warranty_months,
            cleanup: a.cleanup,
            disputes: a.disputes,
            exclusions: a.exclusions,
          }}
        />
      </>
    );
  }

  const canSign = !!a.sent_at && !executed && !mySig && issues.length === 0;

  return (
    <>
      {error}

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="stack" style={{ gap: 4 }}>
            <h2>Agreement</h2>
            <span className="muted small">Revision {a.revision}{executed ? ' · locked' : ''}</span>
          </div>
          <span className={`pill ${executed ? 'ok' : 'warn'}`}>{status}</span>
        </div>
        {executed ? (
          <p className="muted small">Both sides signed. Scope and price are locked. Use the Changes tab for anything new.</p>
        ) : role === 'contractor' ? (
          <p className="muted small">
            {a.sent_at ? 'Sent to the homeowner. Editing clears the sent status and any signatures.' : 'Only you can see this draft until you send it.'}
          </p>
        ) : null}
        <div className="row">
          {role === 'contractor' && !executed && (
            <a className="btn ghost" href={`/projects/${project.id}/agreement?edit=1`}>Edit agreement</a>
          )}
          {role === 'contractor' && !executed && !a.sent_at && issues.length === 0 && (
            <div className="box" style={{ flexBasis: '100%' }}><b>Tip: the Texas disclosure is yours to give.</b><span className="small" style={{ display: 'block' }}>Texas law requires the contractor to give the homeowner a written disclosure statement before they sign a residential construction contract. Jobfile does not supply that wording, so give it to your customer yourself and ask your attorney if you are unsure. The homeowner confirms they received it when they sign.</span></div>
          )}
          {role === 'contractor' && !executed && !a.sent_at && issues.length === 0 && (
            <form action={sendAgreement}>
              <input type="hidden" name="project_id" value={project.id} />
              <button className="btn accent" type="submit">Send to {homeownerName}</button>
            </form>
          )}
          <a className="btn ghost" href={`/projects/${project.id}/agreement/export`}>Download a copy</a>
        </div>
        {role === 'contractor' && !executed && !a.sent_at && issues.length > 0 && (
          <div className="box warn"><b>Before you can send it:</b><br />{issues.join(' ')}</div>
        )}
      </div>

      <article className="doc">
        <div className="stack" style={{ gap: 6 }}>
          <span className="lbl">Home improvement agreement</span>
          <h1>{project.name}</h1>
          <p className="muted">{project.address}</p>
        </div>

        <section>
          <h3>Parties</h3>
          <dl className="kv">
            <dt>Homeowner</dt><dd>{homeownerName}</dd>
            <dt>Contractor</dt><dd>{contractorName}</dd>
          </dl>
        </section>

        <section>
          <h3>Scope of work and price</h3>
          <div className="xs">
            <table className="tbl">
              <thead><tr><th>Item</th><th className="r">Price</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <b>{i.title}</b> {i.kind === 'allowance' ? <span className="pill warn">Allowance</span> : null}
                      {i.description ? <div className="muted small">{i.description}</div> : null}
                    </td>
                    <td className="r">{dollars(i.price_cents)}</td>
                  </tr>
                ))}
                <tr className="tot"><td>Agreed price</td><td className="r">{dollars(t.base)}</td></tr>
              </tbody>
            </table>
          </div>
          {changes.some((c) => c.status === 'approved') && (
            <div className="xs">
              <table className="tbl">
                <thead><tr><th>Approved change orders</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {changes.filter((c) => c.status === 'approved').map((c) => (
                    <tr key={c.id}><td>CO-{c.number} {c.title}</td><td className="r">{dollars(c.cost_cents)}</td></tr>
                  ))}
                  <tr className="tot"><td>Current contract total</td><td className="r">{dollars(t.total)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small">Allowance items are budgets. If the final choice costs more or less, the difference is settled by change order.</p>
        </section>

        <section>
          <h3>Not included</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{a.exclusions || 'Nothing listed.'}</p>
        </section>

        <section>
          <h3>Timeline and terms</h3>
          <dl className="kv">
            <dt>Start</dt><dd>{day(a.start_date)}</dd>
            <dt>Estimated finish</dt><dd>{day(a.end_date)}</dd>
            <dt>Working hours</dt><dd>{a.working_hours}</dd>
            <dt>Permits pulled by</dt><dd>{a.permits_by === 'homeowner' ? 'Homeowner' : 'Contractor'}</dd>
            <dt>Workmanship warranty</dt><dd>{a.warranty_months} months</dd>
            <dt>Cleanup</dt><dd>{a.cleanup}</dd>
            <dt>Disputes</dt><dd>{a.disputes}</dd>
          </dl>
        </section>

        <section>
          <h3>Payment schedule</h3>
          <div className="xs">
            <table className="tbl">
              <thead><tr><th>Milestone</th><th className="r">%</th><th className="r">Amount</th></tr></thead>
              <tbody>
                {ms.map((m, i) => (
                  <tr key={m.id}><td>{m.label}</td><td className="r">{m.pct}%</td><td className="r">{dollars(amts[i])}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3>Standard terms</h3>
          <ol className="std">{STANDARD_TERMS.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>

        <section>
          <h3>Signatures</h3>
          <div className="sigs">
            {(['homeowner', 'contractor'] as const).map((r) => {
              const s = sigs.find((x) => x.role === r);
              return (
                <div key={r} className={`sig ${r}`}>
                  <span className="lbl">{r}</span>
                  {s ? (
                    <>
                      <span className="name">{s.typed_name}</span>
                      <span className="muted small">Signed {stamp(s.signed_at)}</span>
                    </>
                  ) : (
                    <span className="muted">Not signed yet</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </article>

      {canSign && (
        <form action={signAgreement} className="card">
          <h2>Sign as {role}</h2>
          <input type="hidden" name="project_id" value={project.id} />
          {role === 'homeowner' && (
            <>
              <div className="stack">
                <h3>Texas disclosure statement</h3>
                <p className="muted small" style={{ margin: 0 }}>Texas law requires your contractor to give you a written disclosure statement before you sign a residential construction contract. If you have not received it, ask your contractor for it before you sign.</p>
              </div>
              <label className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <input type="checkbox" name="disclosure" />
                <span>My contractor gave me the Texas disclosure statement before I signed.</span>
              </label>
            </>
          )}
          <label className="fld">
            Type your full legal name
            <input name="typed_name" required minLength={3} autoComplete="name" />
          </label>
          <label className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <input type="checkbox" name="agree" />
            <span>I have read this agreement and agree to its scope, price, schedule and terms.</span>
          </label>
          <div className="row"><button className="btn" type="submit">Sign agreement</button></div>
        </form>
      )}

      {!executed && a.sent_at && !mySig && issues.length > 0 && (
        <div className="box warn">This agreement is incomplete: {issues.join(' ')}</div>
      )}
      {!executed && mySig && (
        <div className="box ok">You signed. Waiting for the other side.</div>
      )}

      {project.is_homestead && (
        <form action={saveHomestead} className="card">
          <h2>Texas homestead steps</h2>
          <p className="muted small">
            Texas requires a written contract signed before work or materials start, signed by both spouses if the owner is married,
            and filed with the county clerk. Jobfile records these steps. It does not sign for a spouse or file anything. Ask your
            attorney how to handle a spouse&rsquo;s signature.
          </p>
          <input type="hidden" name="project_id" value={project.id} />
          {role === 'contractor' ? (
            <>
              <label className="row" style={{ flexWrap: 'nowrap' }}>
                <input type="checkbox" name="spouse" defaultChecked={a.homestead_spouse_confirmed} />
                <span>Both spouses have signed a copy of the contract (or the owner is not married)</span>
              </label>
              <label className="fld">
                Date filed with the county clerk
                <input type="date" name="filed_on" defaultValue={a.homestead_filed_on ?? ''} />
              </label>
              <div className="row"><button className="btn ghost" type="submit">Save steps</button></div>
            </>
          ) : (
            <dl className="kv">
              <dt>Spouse signature</dt><dd>{a.homestead_spouse_confirmed ? 'Recorded' : 'Not recorded yet'}</dd>
              <dt>Filed with county clerk</dt><dd>{day(a.homestead_filed_on)}</dd>
            </dl>
          )}
        </form>
      )}
    </>
  );
}
