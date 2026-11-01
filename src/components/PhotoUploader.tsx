'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadPhoto, finishUpload } from '@/app/projects/[id]/photos/actions';

const MAX_FILES = 8;

/** Shrinks a phone photo to about 1600 px on the long side so it uploads fast and stays under request limits. */
async function shrink(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.82),
  );
}

export default function PhotoUploader({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<'progress' | 'fix'>('progress');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const files = Array.from(fileRef.current?.files ?? ([] as File[])).slice(0, MAX_FILES);
    if (!files.length) {
      setMsg({ tone: 'bad', text: 'Choose at least one photo.' });
      return;
    }
    setBusy(true);
    let saved = 0;
    let firstError = '';
    for (let i = 0; i < files.length; i++) {
      setMsg({ tone: 'ok', text: `Uploading photo ${i + 1} of ${files.length}…` });
      try {
        const blob = await shrink(files[i]);
        const fd = new FormData();
        fd.set('project_id', projectId);
        fd.set('kind', kind);
        fd.set('caption', caption);
        fd.set('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
        const r = await uploadPhoto(fd);
        if (r.ok) saved++;
        else if (!firstError) firstError = r.error;
      } catch {
        if (!firstError) firstError = 'One photo could not be read. Try a JPEG or PNG.';
      }
    }
    if (saved > 0) await finishUpload(projectId, kind, saved, caption);
    setBusy(false);
    if (saved > 0) {
      if (fileRef.current) fileRef.current.value = '';
      setCaption('');
      setMsg({ tone: firstError ? 'bad' : 'ok', text: `${saved} photo${saved === 1 ? '' : 's'} added.${firstError ? ' ' + firstError : ''}` });
      router.refresh();
    } else {
      setMsg({ tone: 'bad', text: firstError || 'Nothing was saved.' });
    }
  }

  return (
    <form onSubmit={submit} className="card" aria-label="Add photos">
      <h2>Add photos</h2>
      <div className="chips" role="radiogroup" aria-label="Photo type">
        <label className="chip">
          <input type="radio" name="kind" checked={kind === 'progress'} onChange={() => setKind('progress')} />
          <span>Progress</span>
        </label>
        <label className="chip">
          <input type="radio" name="kind" checked={kind === 'fix'} onChange={() => setKind('fix')} />
          <span>Needs fixing</span>
        </label>
      </div>
      <label className="fld">
        Photos (up to {MAX_FILES} at a time)
        <input ref={fileRef} type="file" accept="image/*" multiple />
      </label>
      <label className="fld">
        Note {kind === 'fix' ? '(what needs fixing and where)' : '(optional)'}
        <textarea rows={2} value={caption} maxLength={500} onChange={(e) => setCaption(e.target.value)} placeholder={kind === 'fix' ? 'Gap in the trim above the range' : 'Cabinets installed'} />
      </label>
      {msg ? <div className={`box ${msg.tone}`} role="status">{msg.text}</div> : null}
      <div className="row">
        <button className="btn accent" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
      </div>
    </form>
  );
}
