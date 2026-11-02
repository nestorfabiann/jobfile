'use client';

import { useEffect, useRef } from 'react';
import { MAX_PHOTOS, MAX_VIDEOS, MAX_VIDEO_BYTES, VIDEO_TYPES } from '@/lib/mediaLimits';
import type { MediaItem } from '@/lib/uploadMedia';

/** Photos and videos chosen on the post form. Nothing uploads until the project is published. */
export default function MediaPicker({ items, setItems, onProblem, disabled }: { items: MediaItem[]; setItems: (f: (prev: MediaItem[]) => MediaItem[]) => void; onProblem: (msg: string) => void; disabled?: boolean }) {
  const photoIn = useRef<HTMLInputElement>(null);
  const videoIn = useRef<HTMLInputElement>(null);
  const live = useRef<MediaItem[]>([]);
  live.current = items;
  useEffect(() => () => live.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const photos = items.filter((i) => i.kind === 'photo').length;
  const videos = items.filter((i) => i.kind === 'video').length;

  function add(kind: 'photo' | 'video', list: FileList | null) {
    if (!list) return;
    onProblem('');
    let p = photos;
    let v = videos;
    const next: MediaItem[] = [];
    for (const file of Array.from(list)) {
      if (kind === 'photo') {
        if (!file.type.startsWith('image/')) { onProblem('Photos must be JPEG, PNG or WebP.'); continue; }
        if (p >= MAX_PHOTOS) { onProblem(`You can add up to ${MAX_PHOTOS} photos.`); break; }
        p++;
      } else {
        if (!VIDEO_TYPES[file.type]) { onProblem('Videos must be MP4, MOV or WebM.'); continue; }
        if (file.size > MAX_VIDEO_BYTES) { onProblem(`That video is ${Math.round(file.size / 1048576)} MB. Videos can be up to 50 MB. Trim it to under a minute, or record it again.`); continue; }
        if (v >= MAX_VIDEOS) { onProblem(`You can add up to ${MAX_VIDEOS} videos.`); break; }
        v++;
      }
      next.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, kind, file, url: URL.createObjectURL(file) });
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
    if (photoIn.current) photoIn.current.value = '';
    if (videoIn.current) videoIn.current.value = '';
  }

  function remove(id: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((i) => i.id !== id);
    });
  }

  const mb = Math.round(items.filter((i) => i.kind === 'video').reduce((s, i) => s + i.file.size, 0) / 1048576);
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input ref={photoIn} type="file" accept="image/*" multiple hidden onChange={(e) => add('photo', e.target.files)} />
      <input ref={videoIn} type="file" accept="video/mp4,video/quicktime,video/webm" multiple hidden onChange={(e) => add('video', e.target.files)} />
      {items.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {items.map((i) => (
              <div key={i.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', background: '#3a3f48' }}>
                {i.kind === 'photo' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.url} alt="Photo to upload" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    <video src={`${i.url}#t=0.1`} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 26, textShadow: '0 1px 6px #0008' }}>▶</span>
                  </>
                )}
                <button type="button" onClick={() => remove(i.id)} disabled={disabled} aria-label="Remove" style={{ position: 'absolute', top: 5, right: 5, width: 28, height: 28, borderRadius: '50%', border: 0, background: 'rgba(0,0,0,.7)', color: '#fff', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ margin: 0 }}>{photos} photo{photos === 1 ? '' : 's'} · {videos} video{videos === 1 ? '' : 's'}{videos ? ` (${mb} MB)` : ''}</p>
        </>
      )}
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button type="button" className="btn ghost" disabled={disabled} onClick={() => photoIn.current?.click()}>📷 {photos ? 'Add more' : 'Add photos'}</button>
        <button type="button" className="btn ghost" disabled={disabled} onClick={() => videoIn.current?.click()}>🎥 Add video</button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>Up to {MAX_PHOTOS} photos and {MAX_VIDEOS} videos. Videos: 50 MB or less each.</p>
    </div>
  );
}
