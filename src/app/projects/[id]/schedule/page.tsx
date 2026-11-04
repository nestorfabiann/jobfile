import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { addDays, fmtDay, fmtRange, scheduleState, todayChi, type Phase } from '@/lib/schedule';
import { addPhase, changePhaseDates, deletePhase, makeStarter, setPhaseStatus } from './actions';

const stamp = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

export default async function Schedule({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const { sb, project, role } = await loadProject(params.id);
  const today = todayChi();
  const [{ data: phaseRows }, { data: chgRows }, { data: agr }, { data: selRows }] = await Promise.all([
    sb.from('project_phases').select('*').eq('project_id', project.id).order('position'),
    sb.from('schedule_changes').select('*').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
    sb.from('agreements').select('start_date,end_date,executed_at').eq('project_id', project.id).maybeSingle(),
    sb.from('selections').select('id,title,needed_by,status').eq('project_id', project.id).eq('status', 'open'),
  ]);
  const phases = (phaseRows ?? []) as Phase[];
  const changes = (chgRows ?? []) as any[];
  const state = scheduleState(phases, today);

  // The homeowner has now seen the date changes.
  if (role === 'homeowner' && changes.some((c) => !c.homeowner_seen_at)) {
    await supabaseAdmin().from('schedule_changes').update({ homeowner_seen_at: new Date().toISOString() }).eq('project_id', project.id).is('homeowner_seen_at', null);
  }

  const week = addDays(today, 7);
  const soon: { key: string; when: string; day: string; text: string; who: string }[] = [];
  phases.forEach((p) => {
    if (p.status === 'done') return;
    if (p.starts_on && p.starts_on >= today && p.starts_on <= week) soon.push({ key: `s${p.id}`, when: p.starts_on, day: fmtDay(p.starts_on), text: `${p.title} starts`, who: 'Both' });
    if (p.ends_on && p.ends_on >= today && p.ends_on <= week) soon.push({ key: `e${p.id}`, when: p.ends_on, day: fmtDay(p.ends_on), text: `${p.title} should be done`, who: 'Contractor' });
  });
  ((selRows ?? []) as any[]).forEach((s) => {
    if (s.needed_by && s.needed_by <= week) soon.push({ key: `c${s.id}`, when: s.needed_by, day: s.needed_by < today ? 'Overdue' : fmtDay(s.needed_by), text: `Choose: ${s.title}`, who: 'Homeowner' });
  });
  soon.sort((a, b) => a.when.localeCompare(b.when));

  const dot = (s: Phase['status']) => (s === 'done' ? 'var(--ok)' : s === 'in_progress' ? 'var(--accent)' : 'var(--line)');

  return (
    <>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Schedule</h2>
          {state.label !== 'Not set up' && <span className={`pill ${state.tone}`}>{state.label}</span>}
        </div>
        <p className="muted small">
          {agr?.start_date && agr?.end_date ? `${fmtRange(agr.start_date as string, agr.end_date as string)} from the agreement. ` : ''}
          {role === 'contractor' ? 'Move a date and both sides see what changed and why.' : 'Your contractor keeps this up to date. Any date change shows below with the reason.'}
        </p>
      </div>

      {phases.length === 0 ? (
        <div className="card">
          <p className="muted">{role === 'contractor' ? 'No phases yet. Add the steps of the job with dates so your customer knows what is coming.' : 'Your contractor has not added a schedule yet.'}</p>
          {role === 'contractor' && (
            <form action={makeStarter} className="row">
              <input type="hidden" name="project_id" value={project.id} />
              <button className="btn accent" type="submit">Start from the agreement dates</button>
            </form>
          )}
        </div>
      ) : (
        <div className="card">
          {phases.map((p) => (
            <div key={p.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', flex: 'none', marginTop: 5, border: `2px solid ${dot(p.status)}`, background: p.status === 'upcoming' ? 'transparent' : dot(p.status) }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{p.title}</b>
                <div className="muted small">{fmtRange(p.starts_on, p.ends_on)} · {p.status === 'done' ? 'done' : p.status === 'in_progress' ? 'in progress' : 'upcoming'}</div>
                {p.note ? <div className="muted small">{p.note}</div> : null}
                {role === 'contractor' && (
                  <details style={{ marginTop: 6 }}>
                    <summary className="small" style={{ cursor: 'pointer', fontWeight: 700 }}>Edit</summary>
                    <div className="stack" style={{ marginTop: 8 }}>
                      <form action={setPhaseStatus} className="row">
                        <input type="hidden" name="project_id" value={project.id} />
                        <input type="hidden" name="id" value={p.id} />
                        {p.status !== 'in_progress' && <button className="btn ghost" name="status" value="in_progress">Started</button>}
                        {p.status !== 'done' && <button className="btn ghost" name="status" value="done">Mark done</button>}
                        {p.status !== 'upcoming' && <button className="btn ghost" name="status" value="upcoming">Not started</button>}
                      </form>
                      <form action={changePhaseDates} className="stack">
                        <input type="hidden" name="project_id" value={project.id} />
                        <input type="hidden" name="id" value={p.id} />
                        <div className="grid2">
                          <label className="fld">Starts<input type="date" name="starts_on" defaultValue={p.starts_on ?? ''} /></label>
                          <label className="fld">Ends<input type="date" name="ends_on" defaultValue={p.ends_on ?? ''} /></label>
                        </div>
                        <label className="fld">Why are the dates changing?<input name="reason" placeholder="Tile delivery was delayed" /></label>
                        <div className="row"><button className="btn" type="submit">Change dates</button></div>
                      </form>
                      <form action={deletePhase}>
                        <input type="hidden" name="project_id" value={project.id} />
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn ghost" type="submit">Remove this phase</button>
                      </form>
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {soon.length > 0 && (
        <div className="card">
          <h3>Coming up this week</h3>
          {soon.map((s) => (
            <div key={s.key} className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><b>{s.day}</b><div className="muted small">{s.text}</div></div>
              <span className="pill">{s.who}</span>
            </div>
          ))}
        </div>
      )}

      {changes.length > 0 && (
        <div className="card">
          <h3>Date changes</h3>
          {changes.map((c) => (
            <div key={c.id} className="box warn" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <b>{c.summary}</b>
              {c.reason ? <span>Reason: {c.reason}</span> : null}
              <span className="small">Logged {stamp(c.created_at)} by the {c.changed_role}.{c.homeowner_seen_at ? ` Homeowner saw it ${stamp(c.homeowner_seen_at)}.` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {role === 'contractor' && (
        <details className="conew">
          <summary className="btn accent">Add a phase</summary>
          <form action={addPhase} className="card stack" style={{ marginTop: 10 }}>
            <input type="hidden" name="project_id" value={project.id} />
            <label className="fld">Name<input name="title" required placeholder="Cabinets and tile" /></label>
            <div className="grid2">
              <label className="fld">Starts<input type="date" name="starts_on" /></label>
              <label className="fld">Ends<input type="date" name="ends_on" /></label>
            </div>
            <label className="fld">Note (optional)<input name="note" placeholder="Tile arrives Nov 14" /></label>
            <div className="row"><button className="btn" type="submit">Add phase</button></div>
          </form>
        </details>
      )}
    </>
  );
}
