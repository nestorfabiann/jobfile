'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadListingPhoto } from '@/app/marketplace/actions';

async function shrink(file: File, max = 1600): Promise<Blob> {
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

export default function ListingPhotoUploader({ listingId }: { listingId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const files = Array.from(ref.current?.files ?? ([] as File[])).slice(0, 8);
    if (!files.length) return setMsg({ tone: 'bad', text: 'Choose a photo first.' });
    setBusy(true);
    let saved = 0;
    let err = '';
    for (let i = 0; i < files.length; i++) {
      setMsg({ tone: 'ok', text: `Uploading ${i + 1} of ${files.length}…` });
      try {
        const fd = new FormData();
        fd.set('listing_id', listingId);
        fd.set('file', new File([await shrink(files[i])], 'photo.jpg', { type: 'image/jpeg' }));
        const r = await uploadListingPhoto(fd);
        if (r.ok) saved++;
        else if (!err) err = r.error;
      } catch {
        if (!err) err = 'One photo could not be read. Try a JPEG or PNG.';
      }
    }
    setBusy(false);
    if (ref.current) ref.current.value = '';
    setMsg({ tone: saved && !err ? 'ok' : 'bad', text: saved ? `${saved} added.${err ? ' ' + err : ''}` : err || 'Nothing was saved.' });
    if (saved) router.refresh();
  }

  return (
    <form onSubmit={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="fld">Add photos (up to 8 at a time)<input ref={ref} type="file" accept="image/*" multiple /></label>
      <div className="row">
        <button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Add photos'}</button>
        {msg && <span role="status" className="small" style={{ color: msg.tone === 'ok' ? 'var(--ok)' : 'var(--bad)' }}>{msg.text}</span>}
      </div>
    </form>
  );
}
