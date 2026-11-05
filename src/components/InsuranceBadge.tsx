/** Insurance status on a bid. Tapping it explains what Jobfile checked, and what it did not. */
export default function InsuranceBadge({ state, name, until, kinds }: { state: 'ok' | 'wait' | 'none'; name: string; until: string; kinds: string[] }) {
  if (state === 'none') {
    return <span className="small muted" style={{ width: 'max-content', border: '1px dashed var(--line)', borderRadius: 99, padding: '5px 12px' }}>No insurance on file</span>;
  }
  const ok = state === 'ok';
  const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, width: 'max-content', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, padding: '6px 12px 6px 9px', borderRadius: 99, minHeight: 32, listStyle: 'none', background: ok ? 'var(--ok-soft, #d9f1e6)' : 'var(--accent-soft, #f9efe4)', color: ok ? 'var(--ok)' : 'var(--accent)' };
  const nice = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <details>
      <summary style={pill}>
        <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          {ok ? <><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
        </svg>
        {ok ? `Insured · verified to ${nice(until)}` : 'Insurance under review'}
      </summary>
      <div className="card" style={{ marginTop: 8, gap: 8, padding: 14 }}>
        {ok ? (
          <>
            <b>Insured · verified by Jobfile</b>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
              <li>{name} uploaded an insurance certificate. Jobfile read it and checked that the name matches and the policy is current.</li>
              <li>Coverage on file: {kinds.join(', ') || 'see their profile'}. The earliest certificate runs to {nice(until)}.</li>
              <li>The badge goes away automatically when a certificate expires.</li>
            </ul>
          </>
        ) : (
          <>
            <b>Insurance under review</b>
            <p className="small" style={{ margin: 0 }}>{name} has uploaded a certificate that Jobfile has not approved yet.</p>
          </>
        )}
      </div>
    </details>
  );
}
