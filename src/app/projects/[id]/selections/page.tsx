import { loadProject } from '@/lib/project';
import { daysBetween, fmtDay, todayChi } from '@/lib/schedule';
import { addSelection, chooseSelection, deleteSelection, reopenSelection } from './actions';

type Sel = { id: string; title: string; note: string; affects: string; needed_by: string | null; status: 'open' | 'chosen'; choice: string; link: string; chosen_at: string | null };

const safeLink = (u: string) => (/^https?:\/\//i.test(u) ? u : '');

export default async function Selections({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const { sb, project, role } = await loadProject(params.id);
  const { data } = await sb.from('selections').select('*').eq('project_id', project.id).order('created_at');
  const today = todayChi();
  const list = ((data ?? []) as Sel[]).sort((a, b) => (a.status === b.status ? (a.needed_by ?? '9999').localeCompare(b.needed_by ?? '9999') : a.status === 'open' ? -1 : 1));
  const open = list.filter((s) => s.status === 'open');

  const duePill = (s: Sel): [string, string] => {
    if (s.status === 'chosen') return ['Chosen', 'ok'];
    if (!s.needed_by) return ['Open', 'warn'];
    const d = daysBetween(today, s.needed_by);
    if (d < 0) return ['Overdue', 'bad'];
    if (d <= 3) return [d === 0 ? 'Due today' : `Due in ${d} day${d === 1 ? '' : 's'}`, 'bad'];
    return ['Open', 'warn'];
  };

  return (
    <>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Selections</h2>
          {open.length > 0 ? <span className="pill warn">{open.length} open</span> : list.length > 0 ? <span className="pill ok">All chosen</span> : null}
        </div>
        <p className="muted small">
          Choices the homeowner makes, each with a date. A late choice can move the schedule, so both sides can see what is waiting.
        </p>
      </div>

      {list.length === 0 && (
        <div className="card"><p className="muted">{role === 'contractor' ? 'Nothing listed yet. Add the choices your customer needs to make, like tile, paint or fixtures.' : 'Your contractor has not listed any choices yet.'}</p></div>
      )}

      {list.map((s) => {
        const [label, tone] = duePill(s);
        return (
          <article className="card" key={s.id}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <div style={{ minWidth: 0 }}>
                <h3>{s.title}</h3>
                <div className="muted small">{[s.needed_by ? `Needed by ${fmtDay(s.needed_by)}` : '', s.affects ? `affects ${s.affects}` : ''].filter(Boolean).join(' · ')}</div>
              </div>
              <span className={`pill ${tone}`}>{label}</span>
            </div>
            {s.note ? <p className="muted small">Contractor note: {s.note}</p> : null}

            {s.status === 'chosen' && (
              <>
                <div className="box ok"><b>Chosen:</b> {s.choice}{safeLink(s.link) ? <> · <a href={safeLink(s.link)} target="_blank" rel="noopener noreferrer">link</a></> : null}</div>
                {role === 'contractor' && (
                  <form action={reopenSelection} className="stack">
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="id" value={s.id} />
                    <label className="fld">Why choose again? (optional)<input name="why" placeholder="That tile is out of stock" /></label>
                    <div className="row"><button className="btn ghost" type="submit">Ask them to choose again</button></div>
                  </form>
                )}
              </>
            )}

            {s.status === 'open' && role === 'homeowner' && (
              <form action={chooseSelection} className="stack">
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="id" value={s.id} />
                <label className="fld">What did you choose?<input name="choice" required placeholder="Product name, color or code" /></label>
                <label className="fld">Link (optional)<input name="link" inputMode="url" placeholder="https://" /></label>
                <div className="row"><button className="btn accent" type="submit">Mark as chosen</button></div>
              </form>
            )}
            {s.status === 'open' && role === 'contractor' && <p className="muted small">Waiting for the homeowner to choose.</p>}

            {role === 'contractor' && (
              <form action={deleteSelection}>
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="id" value={s.id} />
                <button className="btn ghost" type="submit">Remove</button>
              </form>
            )}
          </article>
        );
      })}

      {role === 'contractor' && (
        <details className="conew">
          <summary className="btn accent">Add a choice</summary>
          <form action={addSelection} className="card stack" style={{ marginTop: 10 }}>
            <input type="hidden" name="project_id" value={project.id} />
            <label className="fld">What needs to be chosen?<input name="title" required placeholder="Backsplash tile" /></label>
            <div className="grid2">
              <label className="fld">Needed by<input type="date" name="needed_by" /></label>
              <label className="fld">Affects (optional)<input name="affects" placeholder="Cabinets and tile" /></label>
            </div>
            <label className="fld">Note (optional)<input name="note" placeholder="Order by Friday so it arrives Nov 14." /></label>
            <div className="row"><button className="btn" type="submit">Add and tell the homeowner</button></div>
          </form>
        </details>
      )}
    </>
  );
}
