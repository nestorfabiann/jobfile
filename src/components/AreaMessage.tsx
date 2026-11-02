'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { previewArea, sendArea, type AreaPerson } from '@/app/admin/actions';

function Go({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? 'Sending…' : label}</button>;
}

export default function AreaMessage() {
  const [zip, setZip] = useState('');
  const [radius, setRadius] = useState(25);
  const [who, setWho] = useState('contractors');
  const [people, setPeople] = useState<AreaPerson[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [capped, setCapped] = useState(false);
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  const [r, run] = useFormState(sendArea, null);
  const seq = useRef(0);

  useEffect(() => {
    setConfirming(false);
    if (!/^\d{5}$/.test(zip)) { setPeople([]); setErr(zip ? 'Enter a 5 digit ZIP code.' : ''); return; }
    const mine = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const res = await previewArea({ zip, radius, who });
      if (mine !== seq.current) return;
      setBusy(false);
      if (res.ok) { setPeople(res.people); setCapped(res.capped); setErr(''); } else { setPeople([]); setErr(res.error); }
    }, 350);
    return () => clearTimeout(t);
  }, [zip, radius, who]);

  const chosen = people.filter((p) => !skip[p.id]);
  const skipIds = JSON.stringify(Object.keys(skip).filter((k) => skip[k]));
  const note = who === 'contractors' ? "Uses each contractor's business ZIP." : who === 'homeowners' ? 'Homeowners who posted a project in this area. Accounts without a posted project have no ZIP.' : 'Both groups, counted together.';

  return (
    <form action={run} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input type="hidden" name="zip" value={zip} />
      <input type="hidden" name="radius" value={radius} />
      <input type="hidden" name="who" value={who} />
      <input type="hidden" name="skip" value={skipIds} />

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2>1 · Area</h2>
        <label className="fld">Center ZIP code<input value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" maxLength={5} placeholder="75074" /></label>
        <div><b style={{ fontSize: 32 }}>{radius}</b> <span className="muted">mile radius</span></div>
        <input type="range" min={5} max={100} step={5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Radius in miles" />
        <div className="row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[5, 10, 25, 50].map((n) => <button key={n} type="button" className={radius === n ? 'btn' : 'btn ghost'} style={{ minHeight: 36, padding: '4px 16px' }} onClick={() => setRadius(n)}>{n}</button>)}
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2>2 · Who</h2>
        <div className="row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['contractors', 'Contractors'], ['homeowners', 'Homeowners'], ['both', 'Both']].map(([v, l]) => <button key={v} type="button" className={who === v ? 'btn' : 'btn ghost'} style={{ minHeight: 36, padding: '4px 16px' }} onClick={() => setWho(v)}>{l}</button>)}
        </div>
        <span className="muted small">{note}</span>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2>3 · Matches</h2>
        <div><b style={{ fontSize: 32 }}>{busy ? '…' : chosen.length}</b> <span className="muted">{chosen.length === 1 ? 'person matches' : 'people match'}</span></div>
        {err ? <p className="small" style={{ color: 'var(--bad)', margin: 0 }}>{err}</p> : null}
        {capped ? <p className="small" style={{ color: 'var(--bad)', margin: 0 }}>More than 200 match. Use a smaller radius or skip people before sending.</p> : null}
        {zip.length === 5 && !busy && !err && !people.length ? <p className="muted small" style={{ margin: 0 }}>No one in this area. Try a bigger radius.</p> : null}
        {people.length > 0 && (
          <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 14 }}>
            {people.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--line)', alignItems: 'center', opacity: skip[p.id] ? 0.45 : 1 }}>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere', textDecoration: skip[p.id] ? 'line-through' : 'none' }}>{p.label}{p.kind === 'homeowner' ? ' · homeowner' : ''}</span>
                <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{p.miles} mi <button type="button" className="btn ghost" style={{ minHeight: 30, padding: '2px 10px', marginLeft: 6 }} onClick={() => setSkip((s) => ({ ...s, [p.id]: !s[p.id] }))}>{skip[p.id] ? 'Include' : 'Skip'}</button></span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2>4 · Message</h2>
        <input name="title" placeholder="Subject" maxLength={120} required />
        <textarea name="body" placeholder="Message (shows as an alert in the app)" rows={5} maxLength={2000} required />
        <label className="row small"><input type="checkbox" name="force" /> Email even if they turned alerts off (use for account or safety notices)</label>
      </div>

      {!confirming ? (
        <button type="button" className="btn" disabled={!chosen.length || capped || busy} onClick={(e) => { const f = (e.currentTarget as HTMLButtonElement).form; if (f && f.reportValidity()) setConfirming(true); }}>
          {chosen.length ? `Review and send to ${chosen.length}` : 'Nobody to send to'}
        </button>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2>Confirm</h2>
          <p style={{ margin: 0 }}>Send this alert to <b>{chosen.length}</b> {chosen.length === 1 ? 'person' : 'people'} within {radius} miles of {zip}. It is recorded in the audit log and can't be unsent.</p>
          <Go label="Yes, send now" />
          <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>Not yet</button>
        </div>
      )}
      {r ? <p role="status" className="small" style={{ color: r.ok ? 'var(--ok)' : 'var(--bad)' }}>{r.ok ? r.message : r.error}</p> : null}
    </form>
  );
}
