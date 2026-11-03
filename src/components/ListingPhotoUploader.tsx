'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadMedia, type FileState, type MediaItem } from '@/lib/uploadMedia';
import UploadProgress from '@/components/UploadProgress';

export default function ListingPhotoUploader({ listingId }: { listingId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [states, setStates] = useState<Record<string, FileState>>({});
  const live = useRef<Record<string, FileState>>({});

  function note(id: string, st: FileState) { live.current = { ...live.current, [id]: st }; setStates(live.current); }
  async function run(list: MediaItem[]) {
    setBusy(true);
    await uploadMedia(listingId, list, note);
    setBusy(false);
    router.refresh();
  }
  function finish() { items.forEach((i) => URL.revokeObjectURL(i.url)); setItems([]); live.current = {}; setStates({}); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const files = Array.from(ref.current?.files ?? ([] as File[])).slice(0, 8) as File[];
    if (!files.length) return setMsg({ tone: 'bad', text: 'Choose a photo or video first.' });
    setMsg(null);
    const list: MediaItem[] = files.map((f: File) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, kind: f.type.startsWith('video/') ? ('video' as const) : ('photo' as const), file: f, url: URL.createObjectURL(f) }));
    setItems(list);
    live.current = {};
    setStates({});
    if (ref.current) ref.current.value = '';
    await run(list);
  }
  const allDone = items.length > 0 && items.every((i) => states[i.id]?.status === 'done');

  return (
    <form onSubmit={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="fld">Add photos or videos (videos up to 50 MB)<input ref={ref} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple /></label>
      {items.length ? <UploadProgress items={items} states={states} onRetry={(id) => { const it = items.find((m) => m.id === id); if (it) void run([it]); }} onSkip={finish} skipLabel="Dismiss" /> : null}
      {allDone && !busy ? <button type="button" className="btn ghost" onClick={finish}>Done</button> : null}
      <div className="row">
        <button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
        {msg && <span role="status" className="small" style={{ color: msg.tone === 'ok' ? 'var(--ok)' : 'var(--bad)' }}>{msg.text}</span>}
      </div>
    </form>
  );
}
