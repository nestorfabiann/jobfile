'use client';

import { useState } from 'react';
import { createTip } from '@/app/community/actions';
import { shrinkImage } from '@/lib/uploadMedia';
import { TIP_MAX } from '@/lib/community';

/** Share a short tip. The photo is shrunk on the phone first so it uploads fast. */
export default function TipForm({ trades }: { trades: string[] }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState('');
  const [len, setLen] = useState(0);

  async function submit(fd: FormData) {
    setBusy(true);
    setErr('');
    try {
      const f = fd.get('photo');
      if (f instanceof File && f.size > 0) {
        try { fd.set('photo', new File([await shrinkImage(f)], 'photo.jpg', { type: 'image/jpeg' })); }
        catch { setErr('We could not read that photo. Pick a different one or skip it.'); setBusy(false); return; }
      } else fd.delete('photo');
      await createTip(fd);
    } finally { setBusy(false); }
  }
  return (
    <form action={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {err ? <div className="box bad" role="alert">{err}</div> : null}
      <label className="fld">Tip title<input name="title" required minLength={3} maxLength={100} placeholder="Prime stained wood before painting" /></label>
      <label className="fld">Your tip<textarea name="body" required minLength={20} rows={5} maxLength={TIP_MAX} onChange={(e) => setLen(e.target.value.length)} placeholder="What to do, and why it works. No phone numbers or links." /></label>
      <span className="small muted" style={{ marginTop: -6 }}>{len} / {TIP_MAX}</span>
      <label className="fld">Kind of work (optional)
        <select name="trade" defaultValue=""><option value="">Any</option>{trades.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      </label>
      <label className="fld">A photo (optional)
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : ''); }} />
      </label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview ? <img src={preview} alt="Your photo" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 14 }} /> : null}
      <div className="box warn"><b>Safety first.</b> For electrical, gas, plumbing, roofing or structural work, say when a licensed pro is needed.</div>
      <button className="btn accent" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send my tip'}</button>
      <p className="muted small">Jobfile reviews every tip before it goes live. You will get an alert either way. Your name shows as first name and last initial, or your business name if you are a pro.</p>
    </form>
  );
}
