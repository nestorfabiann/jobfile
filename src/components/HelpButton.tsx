'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { HELP, TOPICS, pageKey, topicForPath, type HelpTopic } from '@/lib/helpContent';

type Who = 'h' | 'c' | 'v';

/** Floating Help button with a sheet of ready answers. No AI, no data access. */
export default function HelpButton({ who }: { who: Who }) {
  const path = usePathname() || '/';
  const pk = pageKey(path);
  const pageHas = !!pk && HELP.some((x) => x.pages?.includes(pk) && (who === 'v' ? true : x.who === 'both' || x.who === who));
  const here = pageHas ? ('page' as const) : topicForPath(path);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<HelpTopic | 'here' | 'all'>('all');
  const [term, setTerm] = useState('');
  const [which, setWhich] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    try { if (!localStorage.getItem('jf-help-seen')) { setHint(true); t = setTimeout(() => setHint(false), 6000); } } catch { /* no storage */ }
    return () => { if (t) clearTimeout(t); };
  }, []);
  useEffect(() => {
    if (!open) return;
    setTopic(here ? 'here' : 'all');
    setWhich(null);
    setTerm('');
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const items = useMemo(() => {
    const t = term.trim().toLowerCase();
    return HELP.filter((x) => (who === 'v' ? true : x.who === 'both' || x.who === who))
      .filter((x) => (t ? `${x.q} ${x.a}`.toLowerCase().includes(t) : topic === 'all' ? true : topic === 'here' ? (here === 'page' ? !!pk && !!x.pages?.includes(pk) : x.topic === here) : x.topic === topic));
  }, [who, term, topic, here, pk]);

  const show = () => {
    setOpen(true);
    setHint(false);
    try { localStorage.setItem('jf-help-seen', '1'); } catch { /* no storage */ }
  };
  const hide = () => { setOpen(false); openerRef.current?.focus(); };
  if (path.startsWith('/admin')) return null;

  return (
    <>
      {hint && !open && <div className="hp-hint" role="status">Questions? Tap here.</div>}
      <button ref={openerRef} type="button" className="hp-fab" aria-label="Help" aria-haspopup="dialog" onClick={show}>?</button>
      {open && (
        <div className="hp-back" onClick={hide}>
          <div className="hp-sheet" role="dialog" aria-modal="true" aria-label="Help" onClick={(e) => e.stopPropagation()}>
            <div className="hp-grab" aria-hidden="true" />
            <div className="hp-head">
              <h2>How can we help?</h2>
              <button ref={closeRef} type="button" className="hp-x" aria-label="Close help" onClick={hide}>×</button>
            </div>
            <input className="hp-search" type="search" placeholder="Search help" value={term} onChange={(e) => { setTerm(e.target.value); setWhich(null); }} aria-label="Search help" />
            {!term.trim() && (
              <div className="hp-chips" role="group" aria-label="Topics">
                {here && <button type="button" aria-pressed={topic === 'here'} onClick={() => { setTopic('here'); setWhich(null); }}>On this page</button>}
                <button type="button" aria-pressed={topic === 'all'} onClick={() => { setTopic('all'); setWhich(null); }}>All</button>
                {TOPICS.map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={topic === k} onClick={() => { setTopic(k); setWhich(null); }}>{l}</button>
                ))}
              </div>
            )}
            <div className="hp-list">
              {items.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing matches that. Try another word.</p>}
              {items.map((x, i) => (
                <div key={`${x.q}-${i}`} className="hp-q">
                  <button type="button" aria-expanded={which === i} onClick={() => setWhich(which === i ? null : i)}>
                    <span>{x.q}</span>
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                  {which === i && <p>{x.a}</p>}
                </div>
              ))}
            </div>
            <p className="muted small" style={{ margin: 0 }}>Still stuck? Inside a project, use Messages to ask the other side.</p>
          </div>
        </div>
      )}
    </>
  );
}
