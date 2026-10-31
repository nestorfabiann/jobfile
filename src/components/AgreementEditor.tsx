'use client';

import { useState } from 'react';
import { saveAgreement } from '@/app/projects/[id]/agreement/actions';

type ItemDraft = { key: string; title: string; kind: string; price: string; desc: string };
type MsDraft = { key: string; label: string; pct: string };
type Props = {
  projectId: string;
  items: { title: string; kind: string; price: string; desc: string }[];
  milestones: { label: string; pct: string }[];
  terms: {
    start: string;
    end: string;
    hours: string;
    permits: string;
    warranty: number;
    cleanup: string;
    disputes: string;
    exclusions: string;
  };
  hadSignatures: boolean;
};

let counter = 0;
const key = () => `k${counter++}`;
const num = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function AgreementEditor({ projectId, items, milestones, terms, hadSignatures }: Props) {
  const [rows, setRows] = useState<ItemDraft[]>(() =>
    (items.length ? items : [{ title: '', kind: 'work', price: '', desc: '' }]).map((i) => ({ ...i, key: key() })),
  );
  const [ms, setMs] = useState<MsDraft[]>(() => milestones.map((m) => ({ ...m, key: key() })));

  const total = rows.reduce((s, r) => s + Math.max(0, num(r.price)), 0);
  const pct = ms.reduce((s, m) => s + num(m.pct), 0);
  const pctOk = Math.abs(pct - 100) < 0.001;

  const setRow = (k: string, patch: Partial<ItemDraft>) => setRows((r) => r.map((x) => (x.key === k ? { ...x, ...patch } : x)));
  const setMsRow = (k: string, patch: Partial<MsDraft>) => setMs((r) => r.map((x) => (x.key === k ? { ...x, ...patch } : x)));

  return (
    <form action={saveAgreement} className="stack" style={{ gap: 16 }}>
      <input type="hidden" name="project_id" value={projectId} />

      {hadSignatures && <div className="box warn">Saving clears the signatures already given. Both sides sign again.</div>}

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Scope and price</h2>
          <b>{usd(total)}</b>
        </div>
        {rows.map((r, i) => (
          <div className="edrow" key={r.key}>
            <div className="grid2">
              <label className="fld">
                Item
                <input name="item_title" value={r.title} onChange={(e) => setRow(r.key, { title: e.target.value })} placeholder="Cabinets, supply and install" />
              </label>
              <label className="fld">
                Price (USD)
                <input name="item_price" value={r.price} onChange={(e) => setRow(r.key, { price: e.target.value })} inputMode="decimal" placeholder="0" />
              </label>
            </div>
            <label className="fld">
              Type
              <select name="item_kind" value={r.kind} onChange={(e) => setRow(r.key, { kind: e.target.value })}>
                <option value="work">Fixed price</option>
                <option value="allowance">Allowance (a budget; the difference is settled by change order)</option>
              </select>
            </label>
            <label className="fld">
              Details
              <textarea name="item_desc" rows={2} value={r.desc} onChange={(e) => setRow(r.key, { desc: e.target.value })} placeholder="Brand, model, finish, what is covered" />
            </label>
            <div className="row">
              <button type="button" className="btn ghost" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} aria-label={`Remove item ${i + 1}`}>
                Remove item
              </button>
            </div>
          </div>
        ))}
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => setRows((x) => [...x, { key: key(), title: '', kind: 'work', price: '', desc: '' }])}>
            Add scope item
          </button>
        </div>
        <label className="fld">
          Not included
          <textarea name="exclusions" rows={3} defaultValue={terms.exclusions} placeholder="Appliances, paint touch-up after move-in, anything not listed above" />
        </label>
      </section>

      <section className="card">
        <h2>Timeline and terms</h2>
        <div className="grid2">
          <label className="fld">Start date<input type="date" name="start_date" defaultValue={terms.start} /></label>
          <label className="fld">Estimated completion<input type="date" name="end_date" defaultValue={terms.end} /></label>
          <label className="fld">Working hours<input name="working_hours" defaultValue={terms.hours} /></label>
          <label className="fld">
            Permits pulled by
            <select name="permits_by" defaultValue={terms.permits}>
              <option value="contractor">Contractor</option>
              <option value="homeowner">Homeowner</option>
            </select>
          </label>
          <label className="fld">Warranty (months)<input name="warranty_months" inputMode="numeric" defaultValue={terms.warranty} /></label>
        </div>
        <label className="fld">Cleanup<textarea name="cleanup" rows={2} defaultValue={terms.cleanup} /></label>
        <label className="fld">Dispute process<textarea name="disputes" rows={2} defaultValue={terms.disputes} /></label>
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Payment schedule</h2>
          <span className={`pill ${pctOk ? 'ok' : 'warn'}`}>{Math.round(pct * 100) / 100}% of 100%</span>
        </div>
        {ms.map((m, i) => (
          <div className="edrow" key={m.key}>
            <div className="grid2">
              <label className="fld">
                Milestone
                <input name="ms_label" value={m.label} onChange={(e) => setMsRow(m.key, { label: e.target.value })} />
              </label>
              <label className="fld">
                Percent of price
                <input name="ms_pct" value={m.pct} onChange={(e) => setMsRow(m.key, { pct: e.target.value })} inputMode="decimal" />
              </label>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">{usd((total * num(m.pct)) / 100)}</span>
              <button type="button" className="btn ghost" onClick={() => setMs((x) => x.filter((y) => y.key !== m.key))} aria-label={`Remove milestone ${i + 1}`}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => setMs((x) => [...x, { key: key(), label: '', pct: '' }])}>
            Add milestone
          </button>
        </div>
        <p className="muted small">Tie each payment to finished work, not to a date. Keep the deposit modest, and check Texas rules before asking for one.</p>
      </section>

      <div className="row">
        <button type="submit" className="btn">Save agreement</button>
        <a className="btn ghost" href={`/projects/${projectId}/agreement`}>Cancel</a>
      </div>
    </form>
  );
}
