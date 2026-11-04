/** Visit preference fields for posting a project and for changing it later. Plain inputs, no server code. */
export const VISIT_PREFS: [string, string, string][] = [
  ['yes', 'Yes, happy to show the job', 'Contractors can ask and you pick a time'],
  ['maybe', 'Maybe, ask me first', 'You approve each request'],
  ['no', 'No, bids only', 'You can still visit after you hire'],
];
export const FREE_TIMES = ['Weekday mornings', 'Weekday evenings', 'Saturdays', 'Sundays'];

export default function VisitPrefFields({ pref = 'yes', free = '' }: { pref?: string; free?: string }) {
  const on = free.split(',').map((x) => x.trim());
  return (
    <>
      <span className="small"><b>Open to a visit before bids?</b></span>
      <div className="stack" style={{ gap: 8 }}>
        {VISIT_PREFS.map(([v, label, sub]) => (
          <label key={v} className="row" style={{ gap: 10, flexWrap: 'nowrap', border: '1.5px solid var(--line)', borderRadius: 16, padding: '12px 14px', background: 'var(--surface, #fff)' }}>
            <input type="radio" name="visit_pref" value={v} defaultChecked={pref === v} style={{ width: 20, height: 20, flex: 'none' }} />
            <span><b>{label}</b><span className="muted small" style={{ display: 'block' }}>{sub}</span></span>
          </label>
        ))}
      </div>
      <span className="small"><b>When are you usually free?</b></span>
      <div className="vchips">
        {FREE_TIMES.map((t) => (
          <label className="vchip" key={t}><input type="checkbox" name="visit_free" value={t} defaultChecked={on.includes(t)} /><span>{t}</span></label>
        ))}
      </div>
    </>
  );
}
