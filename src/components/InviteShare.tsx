'use client';

import { useState } from 'react';

/** Role switch, message, link, and Share / Copy buttons. Share opens the phone's share sheet when there is one. */
export default function InviteShare({ link, messages, initial }: { link: string; messages: { h: string; c: string }; initial: 'h' | 'c' }) {
  const [role, setRole] = useState<'h' | 'c'>(initial);
  const [note, setNote] = useState('');
  const text = messages[role];

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      setNote('Copied. Paste it into a message.');
    } catch {
      setNote('Could not copy. Press and hold the link to copy it.');
    }
  }
  async function share() {
    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        await navigator.share({ title: 'Jobfile', text, url: link });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
    await copy();
  }

  return (
    <>
      <div className="chips" role="radiogroup" aria-label="I am a">
        {([['h', 'I am a homeowner'], ['c', 'I am a contractor']] as const).map(([v, l]) => (
          <label className="chip" key={v}>
            <input type="radio" name="who" value={v} checked={role === v} onChange={() => { setRole(v); setNote(''); }} />
            <span>{l}</span>
          </label>
        ))}
      </div>
      <div className="card">
        <b>Your message</b>
        <div className="box ok" style={{ background: 'var(--surface-2)', color: 'var(--ink)', fontWeight: 400 }}>{text}</div>
        <div className="small muted" style={{ wordBreak: 'break-all' }}>{link}</div>
        <button className="btn" type="button" onClick={share}>Share</button>
        <button className="btn ghost" type="button" onClick={copy}>Copy link</button>
        <div aria-live="polite" className="small muted">{note}</div>
      </div>
    </>
  );
}
