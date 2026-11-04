'use client';

import { useEffect, useRef, useState } from 'react';

type Alert = { id: string; kind: string; title: string; body: string; created_at: string };

const ICONS: Record<string, string> = {
  bid: '<path d="M12 3v18M7 8h7a3 3 0 010 6H8a3 3 0 000 6h9"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pay: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/>',
  bell: '<path d="M6 17V11a6 6 0 1112 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
};
const iconFor = (kind: string) => {
  const k = kind.toLowerCase();
  if (k.includes('bid')) return ICONS.bid;
  if (k.includes('visit') || k.includes('schedule')) return ICONS.cal;
  if (k.includes('pay') || k.includes('milestone')) return ICONS.pay;
  if (k.includes('message') || k.includes('question')) return ICONS.msg;
  return ICONS.bell;
};

/** A pill that drops from the top when something new arrives while Jobfile is open. Tapping it opens the alert. */
export default function AlertPill() {
  const [cur, setCur] = useState<Alert | null>(null);
  const [shown, setShown] = useState(false);
  const queue = useRef<Alert[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const since = useRef(new Date().toISOString());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const busy = useRef(false);

  const next = () => {
    if (busy.current) return;
    const a = queue.current.shift();
    if (!a) return;
    busy.current = true;
    setCur(a);
    requestAnimationFrame(() => setShown(true));
    arm(5000);
  };
  const arm = (ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(close, ms);
  };
  const close = () => {
    clearTimeout(timer.current);
    setShown(false);
    setTimeout(() => { busy.current = false; setCur(null); next(); }, 450);
  };

  useEffect(() => {
    let off = false;
    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const r = await fetch(`/api/alerts?since=${encodeURIComponent(since.current)}`, { cache: 'no-store' });
        if (!r.ok) return;
        const { alerts } = (await r.json()) as { alerts: Alert[] };
        if (off) return;
        alerts.forEach((a) => {
          if (seen.current.has(a.id)) return;
          seen.current.add(a.id);
          if (a.created_at > since.current) since.current = a.created_at;
          queue.current.push(a);
        });
        next();
      } catch { /* try again next time */ }
    };
    const t = setInterval(poll, 30_000);
    const vis = () => { if (document.visibilityState === 'visible') void poll(); };
    document.addEventListener('visibilitychange', vis);
    return () => { off = true; clearInterval(t); document.removeEventListener('visibilitychange', vis); clearTimeout(timer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cur) return null;
  return (
    <a
      className={`ap${shown ? ' show' : ''}`}
      href={`/n/${cur.id}`}
      role="status"
      aria-live="polite"
      onTouchStart={() => clearTimeout(timer.current)}
      onTouchEnd={() => arm(3000)}
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={() => arm(3000)}
    >
      <span className="ap-i"><svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconFor(cur.kind) }} /></span>
      <span className="ap-t"><b>{cur.title}</b>{cur.body ? <span>{cur.body}</span> : null}</span>
      <button type="button" className="ap-x" aria-label="Dismiss" onClick={(e) => { e.preventDefault(); e.stopPropagation(); close(); }}>×</button>
    </a>
  );
}
