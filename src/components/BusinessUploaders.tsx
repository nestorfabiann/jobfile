'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadBusinessPhoto, uploadInsurance } from '@/app/settings/business/actions';

/** Shrinks a phone photo to about 1600 px so it uploads fast and stays under request limits. */
export async function shrink(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.82));
}

type Msg = { tone: 'ok' | 'bad'; text: string } | null;

export function WorkPhotoUploader({ kind, label }: { kind: 'work' | 'logo'; label: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const files = Array.from(ref.current?.files ?? ([] as File[])).slice(0, kind === 'logo' ? 1 : 8);
    if (!files.length) return setMsg({ tone: 'bad', text: 'Choose a photo first.' });
    setBusy(true);
    let saved = 0;
    let err = '';
    for (let i = 0; i < files.length; i++) {
      setMsg({ tone: 'ok', text: `Uploading ${i + 1} of ${files.length}…` });
      try {
        const fd = new FormData();
        fd.set('kind', kind);
        fd.set('caption', caption);
        fd.set('file', new File([await shrink(files[i])], 'photo.jpg', { type: 'image/jpeg' }));
        const r = await uploadBusinessPhoto(fd);
        if (r.ok) saved++;
        else if (!err) err = r.error;
      } catch {
        if (!err) err = 'One photo could not be read. Try a JPEG or PNG.';
      }
    }
    setBusy(false);
    if (ref.current) ref.current.value = '';
    setCaption('');
    setMsg({ tone: saved && !err ? 'ok' : 'bad', text: saved ? `${saved} saved.${err ? ' ' + err : ''}` : err || 'Nothing was saved.' });
    if (saved) router.refresh();
  }

  return (
    <form onSubmit={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="fld">
        {label}
        <input ref={ref} type="file" accept="image/*" multiple={kind === 'work'} />
      </label>
      {kind === 'work' && (
        <label className="fld">
          Caption (optional, applies to this batch)
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={120} placeholder="Kitchen repaint, Plano" />
        </label>
      )}
      <div className="row">
        <button className="btn" disabled={busy}>{busy ? 'Uploading…' : kind === 'logo' ? 'Save logo' : 'Add photos'}</button>
        {msg && <span role="status" className="small" style={{ color: msg.tone === 'ok' ? 'var(--ok)' : 'var(--bad)' }}>{msg.text}</span>}
      </div>
    </form>
  );
}

export function InsuranceUploader({ kind, defaults }: { kind: 'liability' | 'workers_comp'; defaults?: { carrier: string; coverage: string; expires_on: string } }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = ref.current?.files?.[0];
    if (!f) return setMsg({ tone: 'bad', text: 'Choose the certificate file.' });
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData(form);
      fd.delete('file');
      fd.set('kind', kind);
      const blob = f.type === 'application/pdf' ? f : await shrink(f, 2000);
      fd.set('file', new File([blob], f.type === 'application/pdf' ? 'certificate.pdf' : 'certificate.jpg', { type: f.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg' }));
      const r = await uploadInsurance(fd);
      if (r.ok) {
        setMsg({ tone: 'ok', text: 'Sent for review.' });
        if (ref.current) ref.current.value = '';
        router.refresh();
      } else setMsg({ tone: 'bad', text: r.error });
    } catch {
      setMsg({ tone: 'bad', text: 'That file could not be read. Use a PDF or a photo.' });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="fld">
        Certificate (PDF or photo)
        <input ref={ref} type="file" accept="application/pdf,image/*" />
      </label>
      <div className="grid2">
        <label className="fld">Insurance company<input name="carrier" maxLength={120} defaultValue={defaults?.carrier ?? ''} /></label>
        <label className="fld">Coverage amount<input name="coverage" maxLength={60} defaultValue={defaults?.coverage ?? ''} placeholder="$1,000,000" /></label>
        <label className="fld">Policy expires<input name="expires_on" type="date" required defaultValue={defaults?.expires_on ?? ''} /></label>
      </div>
      <div className="row">
        <button className="btn" disabled={busy}>{busy ? 'Uploading…' : defaults ? 'Replace and resubmit' : 'Submit for review'}</button>
        {msg && <span role="status" className="small" style={{ color: msg.tone === 'ok' ? 'var(--ok)' : 'var(--bad)' }}>{msg.text}</span>}
      </div>
    </form>
  );
}
