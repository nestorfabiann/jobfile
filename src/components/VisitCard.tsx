import { calendarUrl, countdown, fmtWhen, visitTodo, type Visit } from '@/lib/visits';
import { addDays, todayChi } from '@/lib/schedule';
import VisitPrefFields from '@/components/VisitPrefFields';
import { answerVisitAsk, askToSeeJob, setVisitPref, cancelVisit, declineTimes, pickVisitTime, proposeVisit, requestVisit, saveAccess, saveVisitReport, setVisitLive } from '@/app/visits/actions';

type Role = 'contractor' | 'homeowner';
type Where = { scope: 'bid' | 'project' | 'listing'; listingId?: string; bidId?: string; projectId?: string; returnPath: string; address?: string; free?: string };

function Hidden({ w, id }: { w: Where; id?: string }) {
  return (
    <>
      <input type="hidden" name="scope" value={w.scope} />
      {w.listingId ? <input type="hidden" name="listing_id" value={w.listingId} /> : null}
      {w.bidId ? <input type="hidden" name="bid_id" value={w.bidId} /> : null}
      {w.projectId ? <input type="hidden" name="project_id" value={w.projectId} /> : null}
      <input type="hidden" name="return_path" value={w.returnPath} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
    </>
  );
}

const TIMES: [string, string][] = [['09:00', '9:00 am'], ['10:00', '10:00 am'], ['12:00', 'Noon'], ['14:00', '2:00 pm'], ['16:00', '4:00 pm'], ['18:00', '6:00 pm']];
const LENGTHS = ['15 minutes', '30 minutes', '1 hour'];
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Tap up to three days, then one time of day. Times are Central. */
function TimePicker() {
  const start = todayChi();
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
  return (
    <>
      <span className="small"><b>Pick up to 3 days</b></span>
      <div className="vdays">
        {days.map((d) => {
          const dt = new Date(`${d}T12:00:00Z`);
          return (
            <label className="vchip" key={d}>
              <input type="checkbox" name="day" value={d} />
              <span>{WEEKDAY[dt.getUTCDay()]}<b>{dt.getUTCDate()}</b></span>
            </label>
          );
        })}
      </div>
      <span className="small"><b>Time of day</b> (Central time)</span>
      <div className="vchips">
        {TIMES.map(([v, label], i) => (
          <label className="vchip" key={v}><input type="radio" name="time" value={v} defaultChecked={i === 1} /><span>{label}</span></label>
        ))}
      </div>
      <label className="fld">Or an exact time<input type="time" name="time_other" /></label>
      <span className="small"><b>How long?</b></span>
      <div className="vchips">
        {LENGTHS.map((l, i) => (
          <label className="vchip" key={l}><input type="radio" name="duration" value={l} defaultChecked={i === 1} /><span>{l}</span></label>
        ))}
      </div>
      <label className="fld">Note (optional)<input name="note" placeholder="I will measure the kitchen." maxLength={500} /></label>
    </>
  );
}

const STEPS = ['Requested', 'Times sent', 'Confirmed', 'Visited'];
function Steps({ at }: { at: number }) {
  return (
    <div className="vsteps" aria-label={`Visit progress: ${STEPS[at]}`}>
      {STEPS.map((s, i) => (
        <span key={s} style={{ display: 'contents' }}>
          {i > 0 && <span className={`vbar ${i <= at ? 'done' : ''}`} />}
          <span className={`vstep ${i < at || at === 3 ? 'done' : i === at ? 'now' : ''}`}><i>{i < at || at === 3 ? '✓' : ''}</i>{s}</span>
        </span>
      ))}
    </div>
  );
}

const LIVE: Record<string, string> = { on_way: 'is on the way', late15: 'is running about 15 minutes late', late30: 'is running about 30 minutes late', arrived: 'has arrived' };

/** One visit, with whatever this person can do next. Times are Central. */
export default function VisitCard({ visit: v, role, where: w }: { visit: Visit; role: Role; where: Where }) {
  if (v.status === 'canceled') return null;
  const todo = visitTodo(v, role);
  const pill = v.status === 'asked' ? (todo ? ['Your turn', 'warn'] : ['Waiting', '']) : v.status === 'done' ? ['Visited', 'ok'] : v.status === 'confirmed' ? ['Confirmed', 'ok'] : todo ? ['Your turn', 'warn'] : ['Waiting', ''];
  const acc = v.access ?? {};
  const accessLines = [['Gate or entry', acc.gate], ['Pets', acc.pets], ['Parking', acc.parking], ['Other', acc.other]].filter(([, x]) => x);
  const at = v.status === 'done' ? 3 : v.status === 'confirmed' ? 2 : v.status === 'proposed' ? 1 : 0;
  // The address is only shared on a project, never on a bid.
  const address = w.scope === 'project' ? w.address : undefined;
  const hoursTo = v.scheduled_for ? (new Date(v.scheduled_for).getTime() - Date.now()) / 3600000 : 99;
  const dayOf = v.status === 'confirmed' && hoursTo <= 12 && hoursTo >= -12;
  const live = v.live?.state && v.live.at && v.scheduled_for && Date.parse(v.live.at) > Date.parse(v.scheduled_for) - 12 * 3600000 ? v.live : null;

  return (
    <div className="box" style={{ background: 'var(--surface-2, #f4efe6)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <b>{v.title}</b>
        <span className={`pill ${pill[1]}`}>{pill[0]}</span>
      </div>

      {v.status === 'confirmed' && v.scheduled_for && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="small muted" style={{ fontWeight: 700 }}>{countdown(v.scheduled_for)}</span>
          <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{fmtWhen(v.scheduled_for)}</span>
          {v.duration_text ? <span className="muted small">About {v.duration_text}</span> : null}
        </div>
      )}
      {v.status !== 'confirmed' && v.duration_text ? <span className="muted small">About {v.duration_text}</span> : null}
      {v.note ? <span className="small">Note: {v.note}</span> : null}
      <Steps at={at} />

      {v.status === 'asked' && todo === 'approve' && (
        <form action={answerVisitAsk} className="stack">
          <Hidden w={w} id={v.id} />
          <span className="small">This contractor asks to see the job before bidding. Approve and you suggest times. Not now sends a polite note, and they can still bid.</span>
          <div className="row">
            <button className="btn accent" name="answer" value="yes">Approve</button>
            <button className="btn ghost" name="answer" value="no">Not now</button>
          </div>
        </form>
      )}
      {v.status === 'asked' && !todo && <span className="small muted">Waiting for the homeowner to approve. You can still bid any time.</span>}

      {v.status === 'requested' && todo === 'propose' && (
        <form action={proposeVisit} className="stack">
          <Hidden w={w} id={v.id} />
          <span className="small"><b>{role === 'contractor' ? 'The homeowner' : 'The contractor'} would like a visit.</b> Tap the days that work for you.{w.free ? ` You said you are usually free: ${w.free}.` : ''}</span>
          <TimePicker />
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
          <span className="small"><b>None of these work?</b> Say when you are free.</span>
          <div className="vchips">
            {['Weekday evenings', 'Saturdays', 'Weekday mornings', 'Next week'].map((x) => (
              <label className="vchip" key={x}><input type="checkbox" name="avail" value={x} /><span>{x}</span></label>
            ))}
          </div>
          <label className="fld">Anything else<input name="why" placeholder="After 5 pm works best" maxLength={250} /></label>
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
              <TimePicker />
              <div className="row"><button className="btn" type="submit">Send new times</button></div>
            </form>
          </details>
        </>
      )}

      {v.status === 'confirmed' && v.scheduled_for && (
        <>
          <div className="row">
            <a className="btn accent" href={calendarUrl(v, address)} target="_blank" rel="noreferrer">Add to my calendar</a>
            {address ? <a className="btn ghost" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Directions</a> : null}
          </div>

          {dayOf && (
            <div className="box" style={{ background: 'var(--surface, #fff)' }}>
              <b>Today</b>
              {live?.state ? <div className="small" style={{ marginTop: 4 }}>{role === 'homeowner' ? 'Your contractor' : 'You told the homeowner you'} {LIVE[live.state]}. <span className="muted">{new Date(live.at!).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })}</span></div> : <div className="small muted" style={{ marginTop: 4 }}>{role === 'homeowner' ? 'You will see an update here when your contractor is on the way.' : 'One tap tells the homeowner where you are.'}</div>}
              {role === 'contractor' && (
                <form action={setVisitLive} className="row" style={{ marginTop: 8 }}>
                  <Hidden w={w} id={v.id} />
                  <button className="btn accent" name="state" value="on_way">I&apos;m on my way</button>
                  <button className="btn ghost" name="state" value="late15">Running 15 min late</button>
                  <button className="btn ghost" name="state" value="late30">Running 30 min late</button>
                  <button className="btn ghost" name="state" value="arrived">I&apos;m here</button>
                </form>
              )}
            </div>
          )}

          {accessLines.length > 0 && (
            <div className="small"><b>Before they arrive</b>{accessLines.map(([k, x]) => <div key={k}>{k}: {x}</div>)}</div>
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

      {(v.status === 'confirmed' || v.status === 'done') && role === 'contractor' && hoursTo <= 1 && (
        <details open={v.status === 'confirmed'}>
          <summary className="small" style={{ cursor: 'pointer', fontWeight: 700 }}>{v.status === 'done' ? 'Edit visit notes' : 'Finish the visit and leave notes'}</summary>
          <form action={saveVisitReport} className="stack" style={{ marginTop: 8 }}>
            <Hidden w={w} id={v.id} />
            <label className="fld">What did you find?<textarea name="report" rows={4} maxLength={1500} defaultValue={v.report ?? ''} placeholder="Kitchen is about 14 by 12 feet. Ceiling needs a skim coat near the vent." /></label>
            <div className="row"><button className="btn accent" type="submit">{v.status === 'done' ? 'Save notes' : 'Mark visited'}</button></div>
          </form>
        </details>
      )}

      {v.status === 'done' && (
        <div className="stack" style={{ gap: 6 }}>
          {v.report ? <div className="small" style={{ whiteSpace: 'pre-wrap' }}><b>Visit notes</b><div>{v.report}</div></div> : <span className="small muted">The visit is done.</span>}
          {w.scope === 'bid' && role === 'contractor' && <a className="btn accent" href="#your-bid">Update my bid</a>}
          {w.scope === 'bid' && role === 'homeowner' && <span className="small"><b>How did it go?</b> Ready to hire? Accept this bid below. Want another look? Ask for another visit.</span>}
        </div>
      )}

      {v.status !== 'done' && (
        <form action={cancelVisit}>
          <Hidden w={w} id={v.id} />
          <button className="btn ghost" type="submit" style={{ minHeight: 38, padding: '4px 14px' }}>{v.status === 'confirmed' ? 'Cancel this visit' : 'Cancel'}</button>
        </form>
      )}
    </div>
  );
}

/** Start a visit: a homeowner asks a bidder; a contractor proposes times; on a project either side can add one. */
export function NewVisit({ role, where: w, again, noDetails, pref, free }: { role: Role; where: Where; again?: boolean; noDetails?: boolean; pref?: string; free?: string }) {
  if (w.scope === 'listing') {
    if (role !== 'contractor') return null;
    if (pref === 'no') return <div className="small" style={{ border: '1px solid var(--line)', borderRadius: 14, padding: '10px 12px' }}><b>Bids only.</b> <span className="muted">This homeowner is not taking visits before hiring.</span></div>;
    return (
      <form action={askToSeeJob} style={{ background: 'var(--warn-bg)', border: '1.5px solid color-mix(in srgb, var(--accent) 35%, var(--surface))', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Hidden w={w} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--accent)', color: 'var(--accent-fg, #fff)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 17, lineHeight: 1.2, display: 'block' }}>Not sure what to charge? See the job first.</b>
            <span className="muted small" style={{ display: 'block', marginTop: 4 }}>{pref === 'maybe' ? 'The homeowner wants to approve each visit request first.' : free ? `The homeowner is happy to show the job and is usually free ${free.toLowerCase()}.` : noDetails ? 'The homeowner left the detail questions blank, so a visit can help you price it right.' : 'Answers help, but seeing the space is the surest way to a firm price.'}</span>
          </div>
        </div>
        <details>
          <summary className="btn accent" style={{ display: 'flex', justifyContent: 'center' }}>Ask to see the job first</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <label className="fld">Note (optional)<input name="note" placeholder="I want to check the ceiling height." maxLength={400} /></label>
            <div className="row"><button className="btn accent" type="submit">Send request</button></div>
          </div>
        </details>
        <span className="muted small">The homeowner suggests times, you pick one. Their address stays private until they hire.</span>
      </form>
    );
  }
  if (w.scope === 'bid' && role === 'homeowner') {
    return (
      <form action={requestVisit} className="stack">
        <Hidden w={w} />
        <details>
          <summary className="btn ghost" style={{ display: 'flex', justifyContent: 'center' }}>{again ? 'Ask for another visit' : 'Request a site visit'}</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <span className="small"><b>When are you free?</b> The contractor will pick times from this.</span>
            <div className="vchips">
              {['Weekday evenings', 'Saturdays', 'Weekday mornings', 'Any time'].map((x) => (
                <label className="vchip" key={x}><input type="checkbox" name="avail" value={x} /><span>{x}</span></label>
              ))}
            </div>
            <label className="fld">Note (optional)<input name="note" placeholder="Please bring color samples." maxLength={300} /></label>
            <div className="row"><button className="btn accent" type="submit">Send request</button></div>
          </div>
        </details>
      </form>
    );
  }
  return (
    <details className="conew">
      <summary className="btn accent">{w.scope === 'bid' ? (again ? 'Propose times for another visit' : 'Propose times for a visit') : 'Add a visit'}</summary>
      <form action={proposeVisit} className="card stack" style={{ marginTop: 10 }}>
        <Hidden w={w} />
        {w.scope === 'project' && <label className="fld">What is it for?<input name="title" placeholder="Final walkthrough" maxLength={120} /></label>}
        <TimePicker />
        <div className="row"><button className="btn" type="submit">Send times</button></div>
      </form>
    </details>
  );
}


/** Homeowner: change visit preference after posting. */
export function VisitPrefEditor({ listingId, returnPath, pref, free }: { listingId: string; returnPath: string; pref: string; free: string }) {
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Site visits: {pref === 'no' ? 'bids only' : pref === 'maybe' ? 'ask me first' : 'open'}{free ? ` · ${free}` : ''}</summary>
      <form action={setVisitPref} className="stack" style={{ marginTop: 10 }}>
        <input type="hidden" name="listing_id" value={listingId} />
        <input type="hidden" name="return_path" value={returnPath} />
        <VisitPrefFields pref={pref} free={free} />
        <div className="row"><button className="btn" type="submit">Save</button></div>
      </form>
    </details>
  );
}
