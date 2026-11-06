'use client';

import { useState } from 'react';
import { createDesign } from '@/app/design/actions';
import { shrinkImage } from '@/lib/uploadMedia';

type Space = 'kitchen' | 'bathroom';

/** Photo in, two ideas out. The photo is shrunk on the phone first so it uploads fast. Option lists come from the page. */
export default function DesignForm({ picks, styles }: { picks: Record<Space, Record<string, string[]>>; styles: string[] }) {
  const [space, setSpace] = useState<Space>('kitchen');
  const [style, setStyle] = useState(styles[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState('');

  async function submit(fd: FormData) {
    setBusy(true);
    setErr('');
    try {
      const f = fd.get('photo');
      if (f instanceof File && f.size > 0) {
        try { fd.set('photo', new File([await shrinkImage(f, 1280)], 'room.jpg', { type: 'image/jpeg' })); }
        catch { setErr('We could not read that photo. Pick a different one.'); setBusy(false); return; }
      } else { setErr('Add a photo of the room.'); setBusy(false); return; }
      await createDesign(fd);
    } finally { setBusy(false); }
  }

  return (
    <form action={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {err ? <div className="box bad" role="alert">{err}</div> : null}
      <div className="stack" style={{ gap: 6 }}>
        <b>Which room?</b>
        <div className="chips" role="radiogroup" aria-label="Room">
          {(['kitchen', 'bathroom'] as Space[]).map((s) => (
            <label className="chip" key={s}><input type="radio" name="space" value={s} checked={space === s} onChange={() => setSpace(s)} /><span>{s === 'kitchen' ? 'Kitchen' : 'Bathroom'}</span></label>
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <b>Add a photo of the room</b>
        <input type="file" name="photo" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : ''); }} />
        {preview ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Your room" style={{ width: '100%', borderRadius: 14, maxHeight: 260, objectFit: 'cover' }} /> : null}
        <span className="muted small">Best: the whole room, good light, from a corner. No people, faces or street address in the photo.</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <b>Style</b>
        <div className="chips" role="radiogroup" aria-label="Style">
          {styles.map((s) => (
            <label className="chip" key={s}><input type="radio" name="style" value={s} checked={style === s} onChange={() => setStyle(s)} /><span>{s}</span></label>
          ))}
        </div>
      </div>
      {Object.entries(picks[space]).map(([label, opts]) => (
        <label key={`${space}-${label}`} className="stack" style={{ gap: 4 }}>
          <b>{label}</b>
          <select name={label} defaultValue={opts[0]}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
        </label>
      ))}
      <label className="stack" style={{ gap: 4 }}>
        <b>Anything else? <span className="muted small">(optional)</span></b>
        <textarea name="notes" rows={2} maxLength={300} placeholder="For example: more light, an island, open shelves" />
      </label>
      <label className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <input type="checkbox" name="consent" style={{ marginTop: 4 }} />
        <span className="small">I understand this photo is sent to an outside AI service to make the ideas. It has no faces or street address.</span>
      </label>
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating ideas… about 30 seconds' : 'Show me ideas'}</button>
      <p className="muted small" style={{ margin: 0 }}>AI ideas are pictures to spark conversation. They are not a plan and not a price.</p>
    </form>
  );
}
