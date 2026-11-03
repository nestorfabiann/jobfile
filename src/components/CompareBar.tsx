'use client';

import { useEffect, useState } from 'react';

/** Bottom bar for picking up to 3 bids. The checkboxes live in the bid cards and point at this form with their form attribute. */
export default function CompareBar({ action }: { action: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const sync = () => {
      const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="compare"]'));
      const on = boxes.filter((b) => b.checked).length;
      boxes.forEach((b) => { b.disabled = on >= 3 && !b.checked; });
      setN(on);
    };
    sync();
    document.addEventListener('change', sync);
    return () => document.removeEventListener('change', sync);
  }, []);
  return (
    <>
      {n > 0 ? <div aria-hidden="true" style={{ height: 72 }} /> : null}
    <form id="cmpform" method="get" action={action} hidden={n === 0} style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: 'var(--surface)', borderTop: '1px solid var(--line)', padding: '12px max(16px, env(safe-area-inset-right, 0px)) calc(12px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))', display: n === 0 ? 'none' : 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
      <span className="muted small">{n} selected{n >= 3 ? ' (most you can compare)' : ''}</span>
      <button className="btn" type="submit" disabled={n < 2}>{n < 2 ? 'Pick 1 more' : `Compare ${n}`}</button>
    </form>
    </>
  );
}
