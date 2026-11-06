'use client';

import { useState, useTransition } from 'react';
import { removeVote, voteIdea } from '@/app/community/actions';

/** Tap an option to vote. Tap another to change it, or remove your vote. Results show after voting. */
export default function IdeaPoll({ postId, options, counts, mine }: { postId: string; options: string[]; counts: number[]; mine: number | null }) {
  const [c, setC] = useState(counts);
  const [m, setM] = useState<number | null>(mine);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const total = c.reduce((a, b) => a + b, 0);
  const apply = (r: { counts: number[]; mine: number | null } | { error: string }, undo: () => void) => {
    if ('error' in r) { undo(); setErr(r.error); } else { setC(r.counts); setM(r.mine); setErr(''); }
  };
  const vote = (i: number) => {
    if (busy || m === i) return;
    const prevM = m, prevC = c;
    setErr('');
    setM(i);
    setC((x) => x.map((n, j) => (j === i ? n + 1 : j === prevM ? Math.max(0, n - 1) : n)));
    start(async () => apply(await voteIdea(postId, i), () => { setM(prevM); setC(prevC); }));
  };
  const remove = () => {
    if (busy || m === null) return;
    const prevM = m, prevC = c;
    setErr('');
    setM(null);
    setC((x) => x.map((n, j) => (j === prevM ? Math.max(0, n - 1) : n)));
    start(async () => apply(await removeVote(postId), () => { setM(prevM); setC(prevC); }));
  };
  return (
    <div className="cmpoll" role="group" aria-label="Poll">
      {options.map((o, i) => {
        const pc = total ? Math.round((c[i] / total) * 100) : 0;
        return (
          <button key={i} type="button" className="cmopt" aria-pressed={m === i} disabled={busy} onClick={() => vote(i)}>
            <span className="cmopt-fill" style={{ width: m !== null ? `${pc}%` : 0 }} />
            <b>{o}</b>
            {m !== null ? <span className="cmopt-pc">{pc}%</span> : null}
          </button>
        );
      })}
      <span className="small muted" role="status">{err || (m !== null ? `Thanks for voting · ${total} vote${total === 1 ? '' : 's'}. Tap another option to change it.` : `Tap to vote · ${total} vote${total === 1 ? '' : 's'}`)}</span>
      {m !== null ? <button type="button" className="small" style={{ alignSelf: 'flex-start', background: 'none', border: 0, padding: 0, color: 'var(--accent)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }} onClick={remove} disabled={busy}>Remove my vote</button> : null}
    </div>
  );
}
