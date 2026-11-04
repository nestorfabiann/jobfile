'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePush } from './PushAlerts';

const KEY = 'jf-welcome-alerts';

/** First-time full-screen invitation to turn on phone alerts. Shows once per phone, only where it can do something, and always has a way out. */
export default function WelcomeAlerts() {
  const path = usePathname();
  const p = usePush();
  const [seen, setSeen] = useState(true);
  const [open, setOpen] = useState(false);
  useEffect(() => { try { setSeen(!!localStorage.getItem(KEY)); } catch { setSeen(true); } }, []);
  const eligible = !seen && (p.state === 'off' || p.state === 'install') && path !== '/app';
  useEffect(() => {
    if (!eligible) return;
    try { localStorage.setItem(KEY, '1'); } catch { /* it may show again next time */ }
    setOpen(true);
  }, [eligible]);
  if (!open) return null;
  const close = () => setOpen(false);
  const install = p.state === 'install';
  return (
    <div className="wa" role="dialog" aria-modal="true" aria-labelledby="wa-t">
      <div className="wa-in">
        <div className="wa-bell" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        </div>
        {install ? (
          <>
            <h2 id="wa-t">Get the app, never miss a bid</h2>
            <p>On iPhone, alerts work from the Home Screen. Two quick steps. No App Store needed.</p>
            <div className="wa-st"><span>1</span><div>Tap <b>Share</b>, then <b>Add to Home Screen</b></div></div>
            <div className="wa-st"><span>2</span><div>Open Jobfile from your Home Screen. We will ask once.</div></div>
            <div className="wa-go">
              <Link className="btn" href="/app" onClick={close}>Show me how</Link>
              <button type="button" onClick={close}>Not now</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="wa-t">Get alerts on this phone</h2>
            <p>We only send what matters. You choose which kinds.</p>
            <div className="wa-li"><b>New bids</b><span>When a contractor bids on your project</span></div>
            <div className="wa-li"><b>Visits</b><span>Requests, times and reminders</span></div>
            <div className="wa-li"><b>Payments and changes</b><span>Requests and change orders</span></div>
            <p className="wa-sm">Change this any time in Settings.</p>
            {p.msg && <div className="box bad">{p.msg}</div>}
            <div className="wa-go">
              <button type="button" className="btn" disabled={p.busy} onClick={async () => { await p.enable(); close(); }}>{p.busy ? 'Turning on…' : 'Turn on alerts'}</button>
              <button type="button" onClick={close}>Not now</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
