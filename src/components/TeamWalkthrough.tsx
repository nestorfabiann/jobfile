'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Step = { t: string; d: string; scene: React.ReactNode };
const row = (k: string, a: React.ReactNode, b?: React.ReactNode, delay = 0, tone = '') => (
  <div key={k} className={`tw-mb tw-a ${tone}`} style={{ animationDelay: `${delay}s` }}><span>{a}</span>{b ? <b>{b}</b> : null}</div>
);

const STEPS: Step[] = [
  { t: 'Some jobs need more than one trade', d: 'A kitchen can need layout, cabinets, countertops and backsplash.', scene: (
    <>
      {row('a', <b>This job needs 4 trades</b>)}
      <div className="tw-a" style={{ animationDelay: '.3s' }}>{['Layout', 'Cabinets', 'Countertops', 'Backsplash'].map((c) => <span key={c} className="tw-chip">{c}</span>)}</div>
      {row('b', 'Teaming up lets you bid on all of it', undefined, 0.8)}
    </>
  ) },
  { t: 'Pick a partner nearby', d: 'Choose a local pro within 50 miles who is open to partnering.', scene: (
    <>
      <div className="tw-mb tw-a"><span className="tw-who"><i style={{ background: '#c4813f' }}>R</i><span><b>Rivera Co.</b><small>Cabinets · 6 mi</small></span></span><b className="tw-ok">Choose</b></div>
      <div className="tw-mb tw-a" style={{ animationDelay: '.4s' }}><span className="tw-who"><i style={{ background: '#2f5f8a' }}>S</i><span><b>Stone &amp; Tile</b><small>Countertops · 9 mi</small></span></span><b className="tw-ok">Choose</b></div>
    </>
  ) },
  { t: 'Set each part and price', d: 'Each of you prices your own part of the job.', scene: (
    <>
      {row('a', 'Layout and cabinets', '$12,000')}
      {row('b', 'Countertops', '$6,500', 0.4)}
      {row('c', 'Backsplash', '$2,900', 0.8)}
      {row('d', <b>Team total</b>, '$21,400', 1.2, 'tw-total')}
    </>
  ) },
  { t: 'They confirm, then the bid goes out', d: 'Your partner confirms their part. Then the homeowner sees one team bid.', scene: (
    <>
      {row('a', 'Partner confirmed their part', <span className="tw-ok">✓</span>)}
      <div className="tw-btn tw-a tw-pulse" style={{ animationDelay: '.5s' }}>Send team bid</div>
      {row('b', <b>Team bid sent ✓</b>, 'One price, all 4 trades', 1.5, 'tw-done')}
    </>
  ) },
];

const KEY = 'jf_team_walkthrough_seen';
const DUR = 3600;

/** A short animated explanation of how a team bid works. Plays once for a first-time visitor, then folds away. */
export default function TeamWalkthrough() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduce, setReduce] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement | null>(null);

  const markSeen = () => { try { localStorage.setItem(KEY, '1'); } catch { /* fine */ } };
  const start = useCallback((auto: boolean) => { setI(0); setPlaying(auto); setOpen(true); }, []);

  useEffect(() => {
    setMounted(true);
    let rm = false;
    try { rm = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { /* fine */ }
    setReduce(rm);
    let seen = false;
    try { seen = localStorage.getItem(KEY) === '1'; } catch { /* fine */ }
    if (!seen) start(!rm);
    const onOpen = () => { start(!rm); root.current?.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' }); };
    window.addEventListener('tw-open', onOpen);
    return () => window.removeEventListener('tw-open', onOpen);
  }, [start]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!open || !playing) return;
    timer.current = setTimeout(() => {
      if (i < STEPS.length - 1) setI(i + 1);
      else { setPlaying(false); markSeen(); }
    }, DUR);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [open, playing, i]);

  const s = STEPS[i];
  return (
    <section ref={root} id="team-walkthrough" className="tw card" aria-label="How a team bid works">
      <div className="tw-head">
        <b>How a team bid works</b>
        {mounted ? <button type="button" className="tw-link" onClick={() => { if (open) { setOpen(false); setPlaying(false); markSeen(); } else start(!reduce); }}>{open ? 'Hide' : '▶ Watch (20 sec)'}</button> : null}
      </div>
      {open ? (
        <div className="tw-body">
          <div className="tw-scene" key={i} aria-live="polite"><div className="tw-in">{s.scene}</div></div>
          <div className="tw-cap"><b>{i + 1}. {s.t}</b><span>{s.d}</span></div>
          <div className={`tw-prog${playing ? '' : ' paused'}`} role="group" aria-label="Steps">
            {STEPS.map((x, k) => (
              <button key={x.t} type="button" aria-label={`Step ${k + 1}: ${x.t}`} aria-current={k === i ? 'step' : undefined} className={k < i ? 'done' : k === i ? 'cur' : ''} style={{ ['--dur' as string]: `${DUR}ms` }} onClick={() => { setI(k); }} />
            ))}
          </div>
          <div className="tw-ctl">
            <span className="small muted">Step {i + 1} of {STEPS.length}</span>
            <span className="row" style={{ gap: 8 }}>
              <button type="button" className="tw-b" onClick={() => setPlaying((p) => !p)}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
              <button type="button" className="tw-b" onClick={() => start(true)}>↺ Replay</button>
            </span>
          </div>
          <ol className="tw-text small">{STEPS.map((x) => <li key={x.t}><b>{x.t}.</b> {x.d}</li>)}</ol>
        </div>
      ) : null}
    </section>
  );
}

/** A small button that opens and plays the walkthrough from anywhere on the page. */
export function WatchTeamHow({ label = 'Watch how it works' }: { label?: string }) {
  return <button type="button" className="btn ghost" onClick={() => window.dispatchEvent(new Event('tw-open'))}>{label}</button>;
}
