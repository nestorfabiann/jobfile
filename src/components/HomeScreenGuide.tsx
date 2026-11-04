'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Dev = 'i' | 'a';
const STEPS: Record<Dev, [string, string][]> = {
  i: [
    ['Open Jobfile in Safari', 'Use Safari, not a link inside another app.'],
    ['Tap the Share button', 'The square with an arrow, at the bottom of the screen.'],
    ['Tap Add to Home Screen', 'Scroll down in the list if you do not see it.'],
    ['Tap Add', 'Jobfile appears on your Home Screen.'],
  ],
  a: [
    ['Open Jobfile in Chrome', 'Use Chrome for the easiest steps.'],
    ['Tap the menu', 'The three dots at the top right.'],
    ['Tap Add to Home screen', 'Or Install app, if you see it.'],
    ['Tap Add', 'Jobfile appears on your Home screen.'],
  ],
};

/** Animated how-to for adding Jobfile to a phone's Home Screen. */
export default function HomeScreenGuide() {
  const [dev, setDev] = useState<Dev>('i');
  const [cur, setCur] = useState(0);
  const [auto, setAuto] = useState(true);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    try {
      if (/android/i.test(navigator.userAgent)) setDev('a');
      const st = (navigator as unknown as { standalone?: boolean }).standalone;
      if (st || window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    } catch { /* keep defaults */ }
  }, []);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setCur((c) => (c + 1) % 4), 3000);
    return () => clearInterval(t);
  }, [auto]);

  const pick = (i: number) => { setCur(i); setAuto(false); };
  const steps = STEPS[dev];
  return (
    <div className="hs">
      {installed && <div className="hs-ok" role="status"><b>You are all set.</b> You are already using Jobfile from your Home Screen.</div>}
      <div className="hs-sw" role="group" aria-label="Device">
        <button type="button" aria-pressed={dev === 'i'} onClick={() => { setDev('i'); setCur(0); }}>iPhone</button>
        <button type="button" aria-pressed={dev === 'a'} onClick={() => { setDev('a'); setCur(0); }}>Android</button>
      </div>
      <div className="hs-stage">
        <div className="hs-ph" aria-hidden="true">
          <div className="hs-bar">jobfile-rosy.vercel.app</div>
          {cur < 3 && (
            <div className="hs-pg"><b>Jobfile</b>Get bids from local pros.<div style={{ marginTop: 10, height: 70, borderRadius: 12, background: '#f9efe4' }} /><div style={{ marginTop: 8, height: 40, borderRadius: 12, background: '#e4f0e8' }} /></div>
          )}
          {cur < 3 && (
            <div className="hs-tb">
              <span>‹</span><span>›</span>
              <span className={`hs-sh${cur === 1 ? ' pulse' : ''}`}>
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  {dev === 'i' ? <path d="M12 15V3M8 7l4-4 4 4M6 11H5v10h14V11h-1" /> : <path d="M12 6h.01M12 12h.01M12 18h.01" />}
                </svg>
              </span>
              <span>▢</span><span>⧉</span>
            </div>
          )}
          <div className={`hs-sheet${cur === 2 ? ' on' : ''}`}>
            <div className="hs-opt">Copy</div>
            <div className="hs-opt">{dev === 'i' ? 'Add Bookmark' : 'Share'}</div>
            <div className="hs-opt hl"><b>{dev === 'i' ? 'Add to Home Screen' : 'Add to Home screen'}</b> +</div>
          </div>
          <div className={`hs-home${cur === 3 ? ' on' : ''}`}>
            {['Mail', 'Maps', 'Photos', 'Notes'].map((n) => <div className="hs-ap" key={n}><i />{n}</div>)}
            <div className="hs-ap"><span className="hs-ic">J</span><b>Jobfile</b></div>
          </div>
        </div>
      </div>
      <div className="hs-steps">
        {steps.map(([t, d], i) => (
          <button key={t} type="button" className="hs-st" aria-pressed={cur === i} onClick={() => pick(i)}>
            <span className="hs-n">{i + 1}</span>
            <span><b>{t}</b><span className="hs-d">{d}</span></span>
          </button>
        ))}
      </div>
      {dev === 'i' && <div className="hs-warn"><b>Using Gmail or Messages?</b> Those open links in a small browser. Tap the compass or &ldquo;Open in Safari&rdquo; first, then follow the steps.</div>}
      <Link className="lm-cta" href="/">Back to Jobfile</Link>
    </div>
  );
}
