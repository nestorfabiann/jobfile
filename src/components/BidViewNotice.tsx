'use client';
import { useEffect, useState } from 'react';

const KEY = 'jf_bidview_notice';

/** One-line disclosure for homeowners, dismissible. Remembered per browser only. */
export default function BidViewNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(localStorage.getItem(KEY) !== '1'); } catch { setShow(true); }
  }, []);
  if (!show) return null;
  return (
    <div className="box" role="note" style={{ background: 'var(--accent-soft, #f9efe4)', display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <span className="small">Contractors can see when you view their bid. They never see how long you looked, and they cannot see your notes or other bids.</span>
      <button type="button" className="btn ghost" style={{ minHeight: 36, padding: '4px 12px', flex: 'none' }} onClick={() => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setShow(false); }}>Got it</button>
    </div>
  );
}
