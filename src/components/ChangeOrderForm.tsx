'use client';

import { useState } from 'react';

const fmt = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const toCents = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** New change order. The person picks "Adds cost" or "Credit" and types a plain positive amount, so no minus sign is needed on a phone keypad. */
export default function ChangeOrderForm({ action, projectId, finalCents, roomCents }: { action: (fd: FormData) => void | Promise<void>; projectId: string; finalCents: number; roomCents: number }) {
  const [credit, setCredit] = useState(false);
  const [amount, setAmount] = useState('');
  const [saves, setSaves] = useState(false);
  const [days, setDays] = useState('');
  const cents = toCents(amount);
  const dayN = Math.min(365, Math.max(0, parseInt(days.replace(/[^0-9]/g, ''), 10) || 0));
  const tooBig = credit && cents > roomCents;
  const seg = (on: boolean, green = false): React.CSSProperties => ({
    flex: 1, minHeight: 42, border: 0, borderRadius: 999, font: '600 13.5px system-ui, sans-serif', cursor: 'pointer', padding: '6px 8px', lineHeight: 1.2,
    background: on ? (green ? 'var(--ok)' : 'var(--accent)') : 'transparent', color: on ? '#fff' : 'var(--muted, #6b655e)',
  });
  const wrap: React.CSSProperties = { display: 'flex', gap: 6, padding: 4, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg, #faf8f4)' };

  return (
    <form action={action} className="card stack" style={{ marginTop: 10 }}>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="cost" value={cents ? String((credit ? -cents : cents) / 100) : '0'} />
      <input type="hidden" name="days" value={String(saves ? -dayN : dayN)} />
      <label className="fld">Title<input name="title" required placeholder={credit ? 'Skip the closet paint' : 'Extra tile in hallway'} /></label>
      <label className="fld">
        What changes
        <textarea name="description" rows={3} placeholder="Describe the work, materials and where." />
      </label>

      <div className="fld">
        What kind of change?
        <div style={wrap} role="group" aria-label="Kind of change">
          <button type="button" style={seg(!credit)} aria-pressed={!credit} onClick={() => setCredit(false)}>Adds cost</button>
          <button type="button" style={seg(credit, true)} aria-pressed={credit} onClick={() => setCredit(true)}>Credit to homeowner</button>
        </div>
      </div>

      <label className="fld">
        {credit ? 'Credit amount' : 'Added cost'}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <b style={{ fontSize: 20, color: credit ? 'var(--ok)' : 'inherit' }}>{credit ? '−$' : '+$'}</b>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" style={{ flex: 1 }} />
        </span>
      </label>
      {credit ? (
        tooBig ? (
          <div className="box bad">This credit is too big. Only {fmt(roomCents)} is left on payments that have not been requested yet. Lower it, or agree on a refund outside Jobfile.</div>
        ) : (
          <div className="box ok">
            <b>{cents ? `This lowers the contract price by ${fmt(cents)}` : 'This lowers the contract price'}</b> and reduces the last payments that have not been requested yet.
            {cents && finalCents > 0 && cents <= finalCents ? ` The final payment goes from ${fmt(finalCents)} to ${fmt(finalCents - cents)}.` : ''}
          </div>
        )
      ) : (
        <div className="box warn">The other side approves it. It becomes its own payment line, billed when the work is done.</div>
      )}

      <div className="fld">
        Schedule
        <div style={wrap} role="group" aria-label="Schedule change">
          <button type="button" style={seg(!saves)} aria-pressed={!saves} onClick={() => setSaves(false)}>Adds days</button>
          <button type="button" style={seg(saves)} aria-pressed={saves} onClick={() => setSaves(true)}>Saves days</button>
        </div>
        <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" placeholder="0" />
      </div>

      <div className="row"><button className={credit ? 'btn' : 'btn'} style={credit ? { background: 'var(--ok)', borderColor: 'var(--ok)' } : undefined} type="submit" disabled={tooBig}>{credit ? 'Send credit for approval' : 'Send for approval'}</button></div>
    </form>
  );
}
