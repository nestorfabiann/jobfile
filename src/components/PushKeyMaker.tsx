'use client';

import { useState } from 'react';
import { makeKeys } from '@/app/admin/push/actions';

/** Shows a fresh pair of keys once, with copy buttons, so they can be pasted into Vercel. */
export default function PushKeyMaker() {
  const [k, setK] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [note, setNote] = useState('');
  const copy = async (t: string, what: string) => {
    try { await navigator.clipboard.writeText(t); setNote(`${what} copied.`); } catch { setNote('Copy did not work. Press and hold the text to copy it.'); }
  };
  return (
    <div className="stack">
      <button type="button" className="btn" onClick={async () => setK(await makeKeys())}>{k ? 'Make a different pair' : 'Make my keys'}</button>
      {k && (
        <div className="card">
          <b>NEXT_PUBLIC_VAPID_PUBLIC_KEY</b>
          <code style={{ wordBreak: 'break-all', fontSize: 12 }}>{k.publicKey}</code>
          <button type="button" className="btn ghost" onClick={() => copy(k.publicKey, 'Public key')}>Copy public key</button>
          <b>VAPID_PRIVATE_KEY</b>
          <code style={{ wordBreak: 'break-all', fontSize: 12 }}>{k.privateKey}</code>
          <button type="button" className="btn ghost" onClick={() => copy(k.privateKey, 'Private key')}>Copy private key</button>
          <p className="muted small" style={{ margin: 0 }}>Keep the private key secret. Do not send it in a chat or email. This pair is not saved anywhere, so copy both before you leave this page.</p>
          {note && <div className="box ok">{note}</div>}
        </div>
      )}
    </div>
  );
}
