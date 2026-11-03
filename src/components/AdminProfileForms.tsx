'use client';

import { useState, type ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { Result } from '@/app/admin/actions';

type Action = (prev: Result | null, f: FormData) => Promise<Result>;
type Field = { name: string; label: string; value: string; textarea?: boolean; inputMode?: 'text' | 'tel' | 'email' | 'numeric'; hint?: string };

function Go({ label, danger }: { label: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={danger ? 'btn accent' : 'btn'} disabled={pending}>{pending ? 'Working…' : label}</button>;
}
function Note({ r }: { r: Result | null }) {
  if (!r) return null;
  return <div role="status" className={`box ${r.ok ? 'ok' : 'bad'}`}>{r.ok ? r.message : r.error}</div>;
}

/** Edit fields, then review the change (old and new value), give a reason, and save. */
export function EditForm({ fields, action, hidden, title }: { fields: Field[]; action: Action; hidden: Record<string, string>; title: string }) {
  const [r, run] = useFormState(action, null);
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.name, f.value])));
  const [review, setReview] = useState(false);
  const diff = fields.filter((f) => vals[f.name] !== f.value);
  return (
    <form action={run} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div style={{ display: review ? 'none' : 'flex', flexDirection: 'column', gap: 10 }}>
        {fields.map((f) => (
          <label key={f.name} className="fld">{f.label}
            {f.textarea ? <textarea name={f.name} rows={3} value={vals[f.name]} onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })} /> : <input name={f.name} inputMode={f.inputMode} value={vals[f.name]} onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })} />}
            {f.hint ? <span className="muted small" style={{ fontWeight: 400 }}>{f.hint}</span> : null}
          </label>
        ))}
        <button type="button" className="btn" disabled={!diff.length} onClick={() => setReview(true)}>{diff.length ? 'Review changes' : 'No changes yet'}</button>
      </div>
      {review && (
        <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Confirm this change</h3>
          <p className="muted small" style={{ margin: 0 }}>{title}</p>
          <dl className="kv">
            {diff.map((f) => (
              <div key={f.name} style={{ display: 'contents' }}>
                <dt>{f.label}</dt>
                <dd><del style={{ color: 'var(--bad)' }}>{f.value || '(empty)'}</del><br /><b style={{ color: 'var(--ok)' }}>{vals[f.name] || '(empty)'}</b></dd>
              </div>
            ))}
          </dl>
          <label className="fld">Reason (saved in the audit log)<input name="reason" required minLength={4} maxLength={500} placeholder="Example: person called to fix a typo" /></label>
          <label className="row" style={{ flexWrap: 'nowrap', gap: 10 }}><input type="checkbox" name="tell" defaultChecked style={{ width: 22, minHeight: 22 }} />Tell them about this change</label>
          <Go label="Save change" />
          <button type="button" className="btn ghost" onClick={() => setReview(false)}>Back</button>
        </div>
      )}
      <Note r={r} />
    </form>
  );
}

/** One admin action: a row with a button that asks for a reason before doing it. */
export function ActionRow({ label, desc, button, danger, action, hidden, extra, tell }: { label: string; desc: string; button: string; danger?: boolean; action: Action; hidden: Record<string, string>; extra?: ReactNode; tell?: boolean }) {
  const [r, run] = useFormState(action, null);
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 10 }}>
        <span><b>{label}</b><span className="muted small" style={{ display: 'block' }}>{desc}</span></span>
        <button type="button" className={danger ? 'btn ghost' : 'btn ghost'} style={{ minHeight: 40, padding: '6px 14px', color: danger ? 'var(--bad)' : undefined, borderColor: danger ? 'var(--bad)' : undefined, flex: 'none' }} onClick={() => setOpen((o) => !o)}>{open ? 'Cancel' : button}</button>
      </div>
      {open && (
        <form action={run} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {extra}
          <label className="fld">Reason (saved in the audit log)<input name="reason" required minLength={4} maxLength={500} /></label>
          {tell ? <label className="row" style={{ flexWrap: 'nowrap', gap: 10 }}><input type="checkbox" name="tell" defaultChecked style={{ width: 22, minHeight: 22 }} />Tell them about this</label> : null}
          <Go label={`Confirm: ${button}`} danger={danger} />
        </form>
      )}
      <Note r={r} />
    </div>
  );
}

export function NoteForm({ type, id, action }: { type: 'user' | 'company'; id: string; action: Action }) {
  const [r, run] = useFormState(action, null);
  return (
    <form action={run} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input type="hidden" name="subject_type" value={type} />
      <input type="hidden" name="subject_id" value={id} />
      <label className="fld">Add a note<textarea name="body" rows={3} maxLength={2000} placeholder="What happened, who you spoke to, what to watch for" /></label>
      <Go label="Save note" />
      <Note r={r} />
    </form>
  );
}
