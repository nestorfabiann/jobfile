'use client';

import { useState, useTransition } from 'react';
import { voteIdea } from '@/app/community/actions';

/** Tap an option to vote once. Results show after voting. */
export default function IdeaPoll({ postId, options, counts, mine }: { postId: string; options: string[]; counts: number[]; mine: number | null }) {
  const [c, setC] = useState(counts);
  const [m, setM] = useState<number | null>(mine);
  const [err, setErr] = useState('');
  const [, start] = useTransition();
  const total = c.reduce((a, b) => a + b, 0);
  const vote = (i: number) => {
    if (m !== null) return;
    setM(i);
    setC((x) => x.map((n, j) => (j === i ? n + 1 : n)));
    start(async () => {
      const r = await voteIdea(postId, i);
      if ('error' in r) { setM(null); setC(counts); setErr(r.error); } else { setC(r.counts); setM(r.mine); }
    });
  };
  return (
    <div className="cmpoll" role="group" aria-label="Poll">
      {options.map((o, i) => {
        const pc = total ? Math.round((c[i] / total) * 100) : 0;
        return (
          <button key={i} type="button" className="cmopt" aria-pressed={m === i} disabled={m !== null} onClick={() => vote(i)}>
            <span className="cmopt-fill" style={{ width: m !== null ? `${pc}%` : 0 }} />
            <b>{o}</b>
            {m !== null ? <span className="cmopt-pc">{pc}%</span> : null}
          </button>
        );
      })}
      <span className="small muted" role="status">{err || (m !== null ? `Thanks for voting · ${total} vote${total === 1 ? '' : 's'}` : `Tap to vote · ${total} vote${total === 1 ? '' : 's'}`)}</span>
    </div>
  );
}
