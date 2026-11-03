'use client';

import { useState } from 'react';

type Check = { ok: boolean; text: string };

/** "Is the work finished?" card at the top of Overview. Contractors close the job; homeowners ask. */
export default function FinishCard(props: {
  role: 'contractor' | 'homeowner';
  projectId: string;
  completed: boolean;
  closeoutStarted: boolean;
  checks: Check[];
  otherName: string;
  asked: boolean;
  setStage: (fd: FormData) => void | Promise<void>;
  requestFinish: (fd: FormData) => void | Promise<void>;
}) {
  const { role, projectId, completed, closeoutStarted, checks, otherName, asked } = props;
  const [confirm, setConfirm] = useState(false);
  const ready = checks.every((c) => c.ok);
  const hidden = <input type="hidden" name="project_id" value={projectId} />;

  if (completed) {
    return role === 'contractor' ? (
      <section className="card" aria-label="Job stage">
        <h2>Project complete</h2>
        <p className="muted small">Something came up? You can move the project back to active.</p>
        <form action={props.setStage}>{hidden}<button className="btn ghost" name="to" value="reopen">Move back to active</button></form>
      </section>
    ) : null;
  }

  if (role === 'homeowner') {
    return (
      <section className="card" aria-label="Is the work finished?" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
        <h2>Is the work finished?</h2>
        <p className="muted">Tell {otherName} the work is done. They confirm and close the job, then you both rate each other.</p>
        {asked ? (
          <div className="box ok">Sent. We asked {otherName} to mark the project complete. You will get an alert when they do.</div>
        ) : (
          <form action={props.requestFinish}>{hidden}<button className="btn" type="submit">The work is finished</button></form>
        )}
      </section>
    );
  }

  if (confirm) {
    return (
      <section className="card" aria-label="Mark complete">
        <h2>Mark this project complete?</h2>
        <p className="muted">This is what happens next:</p>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>{otherName} gets an alert to rate your work.</li>
          <li>You rate {otherName}. Ratings show only after you both rate, or after 14 days.</li>
          <li>The project moves to Completed. You can move it back to active if something comes up.</li>
        </ol>
        <form action={props.setStage}>{hidden}<button className="btn" name="to" value="complete">Yes, mark complete</button></form>
        <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
      </section>
    );
  }

  return (
    <section className="card" aria-label="Is the work finished?" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
      <h2>Is the work finished?</h2>
      {checks.map((c) => (
        <div key={c.text} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 10 }}>
          <span aria-hidden="true" style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, background: c.ok ? 'var(--ok-bg)' : 'var(--line)', color: c.ok ? 'var(--ok)' : 'var(--ink-2)' }}>{c.ok ? '✓' : '•'}</span>
          <span>{c.text}</span>
        </div>
      ))}
      <p className="muted small" style={{ margin: 0 }}>Marking it complete opens ratings for you and the homeowner.</p>
      {ready || closeoutStarted ? (
        <button type="button" className="btn" onClick={() => setConfirm(true)}>Mark project complete</button>
      ) : (
        <>
          <form action={props.setStage}>{hidden}<button className="btn" name="to" value="closeout">Start closeout</button></form>
          <button type="button" className="btn ghost" onClick={() => setConfirm(true)}>Mark complete anyway</button>
          <p className="muted small" style={{ margin: 0 }}>Closeout is for the final walkthrough, punch list and last payment. Texas jobs also need the bills-paid affidavit and lien releases (not tracked in Jobfile yet).</p>
        </>
      )}
    </section>
  );
}
