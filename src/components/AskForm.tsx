'use client';

import { useState } from 'react';
import { createIdea } from '@/app/community/actions';
import { shrinkImage } from '@/lib/uploadMedia';

/** Ask the community. The photo is shrunk on the phone first so it uploads fast. */
export default function AskForm({ trades }: { trades: string[] }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState('');

  async function submit(fd: FormData) {
    setBusy(true);
    setErr('');
    try {
      const f = fd.get('photo');
      if (f instanceof File && f.size > 0) {
        try { fd.set('photo', new File([await shrinkImage(f)], 'photo.jpg', { type: 'image/jpeg' })); }
        catch { setErr('We could not read that photo. Pick a different one or skip it.'); setBusy(false); return; }
      } else fd.delete('photo');
      await createIdea(fd);
    } finally { setBusy(false); }
  }
  return (
    <form action={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {err ? <div className="box bad" role="alert">{err}</div> : null}
      <label className="fld">Your question<input name="title" required minLength={3} maxLength={100} placeholder="Which color for my 1990s oak kitchen cabinets?" /></label>
      <label className="fld">More detail (optional)<textarea name="body" rows={3} maxLength={800} placeholder="Size, style, budget, what you have tried. No phone numbers or links." /></label>
      <label className="fld">Kind of work (optional)
        <select name="trade" defaultValue=""><option value="">Not sure</option>{trades.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      </label>
      <label className="fld">A photo of the space (optional)
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : ''); }} />
      </label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview ? <img src={preview} alt="Your photo" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 14 }} /> : null}
      <div className="card" style={{ gap: 8 }}>
        <b>Add a poll (optional)</b>
        <span className="small muted">People can vote and see the results. Fill in two to four options.</span>
        {[0, 1, 2, 3].map((i) => <input key={i} name={`opt${i}`} maxLength={40} placeholder={`Option ${i + 1}${i < 2 ? '' : ' (optional)'}`} aria-label={`Poll option ${i + 1}`} />)}
      </div>
      <button className="btn accent" type="submit" disabled={busy}>{busy ? 'Posting…' : 'Post my question'}</button>
      <p className="muted small">Be kind and keep it about the project. Phone numbers, emails and web links are not allowed, and anyone can report a post.</p>
    </form>
  );
}
