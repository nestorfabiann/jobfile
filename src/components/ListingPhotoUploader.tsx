'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadMedia } from '@/lib/uploadMedia';

export default function ListingPhotoUploader({ listingId }: { listingId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const files = Array.from(ref.current?.files ?? ([] as File[])).slice(0, 8) as File[];
    if (!files.length) return setMsg({ tone: 'bad', text: 'Choose a photo or video first.' });
    setBusy(true);
    const r = await uploadMedia(listingId, files.map((f: File) => ({ kind: f.type.startsWith('video/') ? ('video' as const) : ('photo' as const), file: f })), (t) => setMsg({ tone: 'ok', text: t }));
    const saved = r.saved;
    const err = r.errors.join(' ');
    setBusy(false);
    if (ref.current) ref.current.value = '';
    setMsg({ tone: saved && !err ? 'ok' : 'bad', text: saved ? `${saved} added.${err ? ' ' + err : ''}` : err || 'Nothing was saved.' });
    if (saved) router.refresh();
  }

  return (
    <form onSubmit={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="fld">Add photos or videos (videos up to 50 MB)<input ref={ref} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple /></label>
      <div className="row">
        <button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
        {msg && <span role="status" className="small" style={{ color: msg.tone === 'ok' ? 'var(--ok)' : 'var(--bad)' }}>{msg.text}</span>}
      </div>
    </form>
  );
}
