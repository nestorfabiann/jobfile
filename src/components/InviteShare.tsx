'use client';

import { useState } from 'react';

type Styles = { short: string; post: string; es: string };

/** Role switch, message style, message, one-tap buttons for WhatsApp / Facebook / text / email, and the phone share sheet. */
export default function InviteShare({ link, messages, initial }: { link: string; messages: { h: Styles; c: Styles }; initial: 'h' | 'c' }) {
  const [role, setRole] = useState<'h' | 'c'>(initial);
  const [style, setStyle] = useState<keyof Styles>('short');
  const [edited, setEdited] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const base = messages[role][style];
  const text = edited ?? base;
  const full = `${text} ${link}`;

  function pick(r: 'h' | 'c', s: keyof Styles) {
    setRole(r); setStyle(s); setEdited(null); setEditing(false); setNote('');
  }
  async function copyText(t: string): Promise<boolean> {
    try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
  }
  async function copy() {
    setNote((await copyText(full)) ? 'Copied. Paste it into a message.' : 'Could not copy. Press and hold the link to copy it.');
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
  async function facebook() {
    // Facebook does not allow a pre-filled post, so the message is copied for pasting.
    const ok = await copyText(full);
    setNote(ok ? 'Message copied. Paste it into your Facebook post.' : 'Could not copy the message. Copy it from above.');
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank', 'noopener');
  }

  const q = encodeURIComponent(full);
  return (
    <>
      <div className="chips" role="radiogroup" aria-label="I am a">
        {([['h', 'I am a homeowner'], ['c', 'I am a contractor']] as const).map(([v, l]) => (
          <label className="chip" key={v}>
            <input type="radio" name="who" value={v} checked={role === v} onChange={() => pick(v, style)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
      <div className="card">
        <b>Your message</b>
        <div className="chips" role="radiogroup" aria-label="Message style">
          {([['short', 'Short'], ['post', 'Facebook post'], ['es', 'Español']] as const).map(([v, l]) => (
            <label className="chip" key={v}>
              <input type="radio" name="style" value={v} checked={style === v} onChange={() => pick(role, v)} />
              <span>{l}</span>
            </label>
          ))}
        </div>
        {editing ? (
          <textarea aria-label="Your message" rows={5} maxLength={600} value={text} onChange={(e) => setEdited(e.target.value)} />
        ) : (
          <div className="box ok" style={{ background: 'var(--surface-2)', color: 'var(--ink)', fontWeight: 400 }}>{text}</div>
        )}
        <button className="btn ghost" type="button" style={{ alignSelf: 'flex-start', minHeight: 0, padding: '6px 14px' }} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit message'}</button>
        <div className="small muted" style={{ wordBreak: 'break-all' }}>{link}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <a className="btn" style={{ background: '#1f8f4d' }} href={`https://wa.me/?text=${q}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <button className="btn" type="button" style={{ background: '#2f5f9a' }} onClick={facebook}>Facebook</button>
          <a className="btn" style={{ background: '#4a453f' }} href={`sms:?&body=${q}`}>Text message</a>
          <a className="btn" style={{ background: '#8a5a1a' }} href={`mailto:?subject=${encodeURIComponent('Jobfile')}&body=${q}`}>Email</a>
        </div>
        <button className="btn ghost" type="button" onClick={share}>More options…</button>
        <button className="btn ghost" type="button" onClick={copy}>Copy link</button>
        <div aria-live="polite" className="small muted">{note}</div>
      </div>
    </>
  );
}
