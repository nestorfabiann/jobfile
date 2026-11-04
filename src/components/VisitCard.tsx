import { fmtWhen, visitTodo, type Visit } from '@/lib/visits';
import { cancelVisit, declineTimes, pickVisitTime, proposeVisit, requestVisit, saveAccess } from '@/app/visits/actions';

type Role = 'contractor' | 'homeowner';
type Where = { scope: 'bid' | 'project'; bidId?: string; projectId?: string; returnPath: string };

function Hidden({ w, id }: { w: Where; id?: string }) {
  return (
    <>
      <input type="hidden" name="scope" value={w.scope} />
      {w.bidId ? <input type="hidden" name="bid_id" value={w.bidId} /> : null}
      {w.projectId ? <input type="hidden" name="project_id" value={w.projectId} /> : null}
      <input type="hidden" name="return_path" value={w.returnPath} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
    </>
  );
}

function SlotFields() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <label className="fld" key={i}>Time {i}{i > 1 ? ' (optional)' : ''}<input type="datetime-local" name={`slot${i}`} required={i === 1} /></label>
      ))}
      <label className="fld">How long? (optional)<input name="duration" placeholder="About 30 minutes" maxLength={60} /></label>
      <label className="fld">Note (optional)<input name="note" placeholder="I will measure the kitchen." maxLength={500} /></label>
    </>
  );
}

/** One visit, with whatever this person can do next. Times are Central. */
export default function VisitCard({ visit: v, role, where: w }: { visit: Visit; role: Role; where: Where }) {
  if (v.status === 'canceled') return null;
  const todo = visitTodo(v, role);
  const pill = v.status === 'confirmed' ? ['Confirmed', 'ok'] : todo ? ['Your turn', 'warn'] : ['Waiting', ''];
  const acc = v.access ?? {};
  const accessLines = [['Gate or entry', acc.gate], ['Pets', acc.pets], ['Parking', acc.parking], ['Other', acc.other]].filter(([, x]) => x);

  return (
    <div className="box" style={{ background: 'var(--surface-2, #f4efe6)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <b>{v.title}{v.status === 'confirmed' && v.scheduled_for ? `: ${fmtWhen(v.scheduled_for)}` : ''}</b>
        <span className={`pill ${pill[1]}`}>{pill[0]}</span>
      </div>
      {v.duration_text ? <span className="muted small">{v.duration_text}</span> : null}
      {v.note ? <span className="small">Note: {v.note}</span> : null}

      {v.status === 'requested' && todo === 'propose' && (
        <form action={proposeVisit} className="stack">
          <Hidden w={w} id={v.id} />
          <span className="small"><b>{role === 'contractor' ? 'The homeowner' : 'The contractor'} would like a visit.</b> Propose up to three times.</span>
          <SlotFields />
          <div className="row"><button className="btn accent" type="submit">Send times</button></div>
        </form>
      )}
      {v.status === 'requested' && !todo && <span className="small muted">Waiting for {role === 'homeowner' ? 'the contractor' : 'the homeowner'} to propose times.</span>}

      {v.status === 'proposed' && todo === 'pick' && (
        <form action={pickVisitTime} className="stack">
          <Hidden w={w} id={v.id} />
          <span className="small"><b>Pick a time that works.</b></span>
          {v.slots.map((s, i) => (
            <label key={s} className="row" style={{ gap: 10, flexWrap: 'nowrap', border: '1.5px solid var(--line)', borderRadius: 14, padding: '10px 12px', background: 'var(--surface, #fff)' }}>
              <input type="radio" name="slot" value={i} defaultChecked={i === 0} style={{ width: 20, height: 20 }} />
              <b>{fmtWhen(s)}</b>
            </label>
          ))}
          <div className="row"><button className="btn accent" type="submit">Confirm this time</button></div>
        </form>
      )}
      {v.status === 'proposed' && todo === 'pick' && (
        <form action={declineTimes} className="stack">
          <Hidden w={w} id={v.id} />
          <label className="fld">None of these work? Say what does<input name="why" placeholder="Weekday evenings work better" maxLength={300} /></label>
          <div className="row"><button className="btn ghost" type="submit">Ask for other times</button></div>
        </form>
      )}
      {v.status === 'proposed' && !todo && (
        <>
          <span className="small muted">Waiting for {role === 'homeowner' ? 'the contractor' : 'the homeowner'} to pick: {v.slots.map(fmtWhen).join(' · ')}</span>
          <details>
            <summary className="small" style={{ cursor: 'pointer', fontWeight: 700 }}>Change the times</summary>
            <form action={proposeVisit} className="stack" style={{ marginTop: 8 }}>
              <Hidden w={w} id={v.id} />
              <SlotFields />
              <div className="row"><button className="btn" type="submit">Send new times</button></div>
            </form>
          </details>
        </>
      )}

      {v.status === 'confirmed' && (
        <>
          {accessLines.length > 0 && (
            <div className="small"><b>Access notes</b>{accessLines.map(([k, x]) => <div key={k}>{k}: {x}</div>)}</div>
          )}
          {role === 'homeowner' && (
            <details>
              <summary className="small" style={{ cursor: 'pointer', fontWeight: 700 }}>{accessLines.length ? 'Edit access notes' : 'Add access notes'}</summary>
              <form action={saveAccess} className="stack" style={{ marginTop: 8 }}>
                <Hidden w={w} id={v.id} />
                <span className="muted small">Only the other person on this project sees these, and only after the visit is confirmed.</span>
                <label className="fld">Gate or entry<input name="gate" defaultValue={acc.gate ?? ''} placeholder="Side gate, code 4821" maxLength={120} /></label>
                <div className="grid2">
                  <label className="fld">Pets<input name="pets" defaultValue={acc.pets ?? ''} placeholder="Dog, friendly" maxLength={120} /></label>
                  <label className="fld">Parking<input name="parking" defaultValue={acc.parking ?? ''} placeholder="Driveway" maxLength={120} /></label>
                </div>
                <label className="fld">Anything else<input name="other" defaultValue={acc.other ?? ''} placeholder="Please text when you arrive" maxLength={200} /></label>
                <div className="row"><button className="btn" type="submit">Save access notes</button></div>
              </form>
            </details>
          )}
        </>
      )}

      <form action={cancelVisit}>
        <Hidden w={w} id={v.id} />
        <button className="btn ghost" type="submit" style={{ minHeight: 38, padding: '4px 14px' }}>{v.status === 'confirmed' ? 'Cancel this visit' : 'Cancel'}</button>
      </form>
    </div>
  );
}

/** Start a visit: a homeowner asks a bidder; a contractor proposes times; on a project either side can add one. */
export function NewVisit({ role, where: w }: { role: Role; where: Where }) {
  if (w.scope === 'bid' && role === 'homeowner') {
    return (
      <form action={requestVisit}>
        <Hidden w={w} />
        <button className="btn ghost" type="submit">Request a site visit</button>
      </form>
    );
  }
  return (
    <details className="conew">
      <summary className="btn accent">{w.scope === 'bid' ? 'Propose times for a visit' : 'Add a visit'}</summary>
      <form action={proposeVisit} className="card stack" style={{ marginTop: 10 }}>
        <Hidden w={w} />
        {w.scope === 'project' && <label className="fld">What is it for?<input name="title" placeholder="Final walkthrough" maxLength={120} /></label>}
        <SlotFields />
        <div className="row"><button className="btn" type="submit">Send times</button></div>
      </form>
    </details>
  );
}
