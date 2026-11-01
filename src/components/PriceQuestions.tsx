'use client';

import { useState } from 'react';
import { sendMessage } from '@/app/projects/[id]/actions';

type Q = { id: string; title: string; question: string; flagged: boolean };

/** Lets the homeowner pick questions and send them to the contractor as one tagged Question in Messages. */
export default function PriceQuestions({ projectId, contractorName, items }: { projectId: string; contractorName: string; items: Q[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(items.filter((i) => i.flagged).map((i) => i.id)));
  const [sent, setSent] = useState(false);
  const chosen = items.filter((i) => picked.has(i.id));

  const body = chosen.length
    ? `Hi, a few questions about the agreement:\n\n${chosen.map((q, n) => `${n + 1}. ${q.title}: ${q.question}`).join('\n')}\n\nThanks!`
    : '';

  async function send(fd: FormData) {
    await sendMessage(fd);
    setSent(true);
  }

  return (
    <form action={send} className="card" aria-label="Questions for your contractor">
      <h2>Questions for {contractorName}</h2>
      <p className="muted small">Tick the ones you want to ask. They go to Messages as one question. {contractorName} is not told a price check was run.</p>
      <div className="stack">
        {items.map((q) => (
          <label key={q.id} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <input
              type="checkbox"
              checked={picked.has(q.id)}
              onChange={(e) => {
                setSent(false);
                const next = new Set(picked);
                if (e.target.checked) next.add(q.id);
                else next.delete(q.id);
                setPicked(next);
              }}
            />
            <span>
              <b>{q.title}</b>
              <span className="muted small" style={{ display: 'block' }}>{q.question}</span>
            </span>
          </label>
        ))}
      </div>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="tag" value="question" />
      <input type="hidden" name="body" value={body} />
      {sent && <div className="box ok" role="status">Sent. You can see it in Messages.</div>}
      <div className="row">
        <button className="btn" type="submit" disabled={!chosen.length}>Send {chosen.length || ''} question{chosen.length === 1 ? '' : 's'} to {contractorName}</button>
      </div>
    </form>
  );
}
