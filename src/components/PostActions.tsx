'use client';

import { useState, useTransition } from 'react';
import { toggleLike, toggleSave } from '@/app/community/actions';

const Heart = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.6-9 9-9 9z" /></svg>;
const Mark = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>;
const Up = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7h16v-7M12 4v11M8 8l4-4 4 4" /></svg>;

/** Like, save and share with instant feedback. The server confirms; a failure puts the button back. */
export default function PostActions({ postId, title, liked, likes, saved }: { postId: string; title: string; liked: boolean; likes: number; saved: boolean }) {
  const [l, setL] = useState({ on: liked, n: likes });
  const [s, setS] = useState(saved);
  const [msg, setMsg] = useState('');
  const [, start] = useTransition();

  const like = () => {
    const next = { on: !l.on, n: l.n + (l.on ? -1 : 1) };
    const prev = l;
    setL(next);
    start(async () => { const r = await toggleLike(postId); if ('error' in r) { setL(prev); setMsg(r.error); } });
  };
  const save = () => {
    const prev = s;
    setS(!s);
    start(async () => { const r = await toggleSave(postId); if ('error' in r) { setS(prev); setMsg(r.error); } });
  };
  const share = async () => {
    const url = `${window.location.origin}/community/${postId}`;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setMsg('Link copied');
    } catch { setMsg(url); }
    window.setTimeout(() => setMsg(''), 3500);
  };
  return (
    <div className="cmacts">
      <button type="button" className="cmib" aria-pressed={l.on} onClick={like}><Heart /><span>{l.n}</span></button>
      <button type="button" className="cmib" aria-pressed={s} onClick={save}><Mark /><span>{s ? 'Saved' : 'Save'}</span></button>
      <button type="button" className="cmib" onClick={share}><Up /><span>Share</span></button>
      {msg ? <span className="small muted" role="status" style={{ overflowWrap: 'anywhere' }}>{msg}</span> : null}
    </div>
  );
}
