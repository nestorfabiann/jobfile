'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Prefs = { bids: boolean; visits: boolean; pay: boolean; msg: boolean; tips: boolean };
type State = 'loading' | 'hidden' | 'install' | 'unsupported' | 'blocked' | 'off' | 'on';

const ROWS: [keyof Prefs, string, string][] = [
  ['bids', 'Bids and community', 'When a contractor bids on your project, or someone replies to your Community post'],
  ['visits', 'Visits', 'Requests, times and reminders'],
  ['pay', 'Payments and changes', 'Payment requests and change orders'],
  ['msg', 'Messages', 'New messages and questions in a project'],
  ['tips', 'Tips and local news', 'Occasional updates from Jobfile'],
];

const b64 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function post(body: unknown) {
  const r = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok;
}

export function usePush() {
  const [state, setState] = useState<State>('loading');
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    try {
      const ua = navigator.userAgent;
      const ios = /iphone|ipad/i.test(ua);
      const standalone = (navigator as unknown as { standalone?: boolean }).standalone || window.matchMedia('(display-mode: standalone)').matches;
      let endpoint = '';
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (supported) {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = await reg?.pushManager.getSubscription();
        endpoint = sub?.endpoint ?? '';
      }
      const r = await fetch(`/api/push?endpoint=${encodeURIComponent(endpoint)}`, { cache: 'no-store' });
      const d = await r.json();
      if (!d.configured) return setState('hidden');
      setKey(d.key);
      if (ios && !standalone) return setState('install');
      if (!supported) return setState('unsupported');
      if (Notification.permission === 'denied') return setState('blocked');
      if (d.subscribed) { setPrefs(d.prefs); return setState('on'); }
      setState('off');
    } catch { setState('hidden'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const enable = async () => {
    setBusy(true); setMsg('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'blocked' : 'off'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }));
      if (!(await post({ action: 'subscribe', subscription: sub.toJSON() }))) throw new Error('save');
      await refresh();
    } catch { setMsg('Could not turn on alerts. Try again in a moment.'); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await post({ action: 'unsubscribe', endpoint: sub.endpoint }); await sub.unsubscribe(); }
      setPrefs(null); setState('off');
    } catch { setMsg('Could not turn off alerts. Try again.'); }
    finally { setBusy(false); }
  };
  const toggle = async (k: keyof Prefs) => {
    if (!prefs) return;
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await post({ action: 'prefs', endpoint: sub.endpoint, prefs: next });
    } catch { /* the switch already moved; the next refresh shows the saved value */ }
  };
  return { state, prefs, busy, msg, enable, disable, toggle };
}

/** Settings card: turn phone alerts on or off and choose which kinds. */
function AlertExample() {
  return (
    <div className="pex" aria-label="Example of a phone alert">
      <span className="pex-lab">Example</span>
      <div className="pex-n">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={36} height={36} />
        <div><div className="pex-h"><b>Jobfile</b><span>now</span></div><b>New bid on Bathroom remodel</b><span>Nesty&rsquo;s Painting bid $4,200. Tap to compare.</span></div>
      </div>
    </div>
  );
}

export default function PushSettings() {
  const p = usePush();
  if (p.state === 'loading' || p.state === 'hidden') return null;
  return (
    <div className="card" id="phone-alerts">
      <h2>Phone alerts</h2>
      {p.state === 'install' && (
        <>
          <p className="muted">Alerts need the Home Screen app on iPhone. Add Jobfile to your Home Screen first, then come back here to turn alerts on. It takes about 10 seconds.</p>
          <AlertExample />
          <Link className="btn" href="/app">Show me how</Link>
        </>
      )}
      {p.state === 'unsupported' && <p className="muted">This browser cannot show phone alerts. Try Chrome on Android or Safari on a computer.</p>}
      {p.state === 'blocked' && <p className="muted">Alerts are blocked for Jobfile. Open your phone&apos;s Settings, find Jobfile or your browser, and allow Notifications. Then come back here.</p>}
      {p.state === 'off' && (
        <>
          <p className="muted">Get new bids, visit times and payment requests on this phone, even when Jobfile is closed.</p>
          <AlertExample />
          <button type="button" className="btn" disabled={p.busy} onClick={p.enable}>{p.busy ? 'Turning on…' : 'Turn on alerts'}</button>
        </>
      )}
      {p.state === 'on' && p.prefs && (
        <>
          <div className="hp-tg"><div><b>Phone alerts</b><span>On this phone</span></div><button type="button" className="hp-sl" aria-pressed="true" aria-label="Phone alerts" disabled={p.busy} onClick={p.disable} /></div>
          {ROWS.map(([k, t, d]) => (
            <div className="hp-tg" key={k}><div><b>{t}</b><span>{d}</span></div><button type="button" className="hp-sl" aria-pressed={p.prefs![k]} aria-label={t} onClick={() => p.toggle(k)} /></div>
          ))}
          <p className="muted small" style={{ margin: 0 }}>These sit alongside your email and text settings. Turning a switch off only stops the phone alert.</p>
        </>
      )}
      {p.msg && <div className="box bad">{p.msg}</div>}
    </div>
  );
}

const KEY = 'jf-push-card';

/** One-time card on Projects, shown only when alerts can be turned on right now. */
export function PushCard() {
  const p = usePush();
  const [gone, setGone] = useState(true);
  useEffect(() => { try { setGone(!!localStorage.getItem(KEY)); } catch { setGone(false); } }, []);
  if (gone || p.state !== 'off') return null;
  const hide = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setGone(true); };
  return (
    <section className="hsc" aria-label="Phone alerts">
      <div className="hsc-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={52} height={52} />
        <div><b>Get alerts on your phone</b><span>New bids, visit times and payment requests, even when Jobfile is closed.</span></div>
      </div>
      <div className="hsc-row">
        <button type="button" className="hsc-go" style={{ border: 0, cursor: 'pointer' }} disabled={p.busy} onClick={async () => { await p.enable(); hide(); }}>{p.busy ? 'Turning on…' : 'Turn on alerts'}</button>
        <button type="button" onClick={hide}>Not now</button>
      </div>
      {p.msg && <span className="hsc-top" style={{ color: '#f3c98f', fontSize: 13 }}>{p.msg}</span>}
    </section>
  );
}
