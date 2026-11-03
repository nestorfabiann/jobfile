'use client';

import { uploadListingPhoto, videoUploadUrl, saveListingVideo } from '@/app/marketplace/actions';
import { supabaseBrowser } from '@/lib/supabase/browser';

export type MediaItem = { id: string; kind: 'photo' | 'video'; file: File; url: string };

export async function shrinkImage(file: File, max = 1600): Promise<Blob> {
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

export type FileState = { status: 'wait' | 'active' | 'done' | 'error'; pct?: number; error?: string };

/** Sends a video straight to storage with a signed token, reporting percent. Falls back to the library upload if the direct request is refused. */
async function putVideo(bucket: string, path: string, token: string, file: File, onPct: (n: number) => void): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const direct = await new Promise<'ok' | 'refused' | 'network'>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${base}/storage/v1/object/upload/sign/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token)}`);
    xhr.setRequestHeader('apikey', key);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? 'ok' : 'refused');
    xhr.onerror = () => resolve('network');
    xhr.ontimeout = () => resolve('network');
    const fd = new FormData();
    fd.append('cacheControl', '3600');
    fd.append('', file);
    xhr.send(fd);
  });
  if (direct === 'ok') return null;
  if (direct === 'network') return 'Lost connection';
  const up = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file, { contentType: file.type });
  return up.error ? 'Upload failed' : null;
}

/** Uploads photos through the server (they are shrunk first) and videos straight to storage, one file at a time.
 *  Reports each file's own state. Never throws. Call it again with only the failed files to retry. */
export async function uploadMedia(listingId: string, items: { id: string; kind: 'photo' | 'video'; file: File }[], onState: (id: string, s: FileState) => void) {
  let saved = 0;
  for (const it of items) {
    onState(it.id, { status: 'active', pct: 0 });
    try {
      if (it.kind === 'photo') {
        const fd = new FormData();
        fd.set('listing_id', listingId);
        fd.set('file', new File([await shrinkImage(it.file)], 'photo.jpg', { type: 'image/jpeg' }));
        const r = await uploadListingPhoto(fd);
        if (r.ok) { saved++; onState(it.id, { status: 'done' }); } else onState(it.id, { status: 'error', error: r.error });
      } else {
        const t = await videoUploadUrl({ listingId, contentType: it.file.type, size: it.file.size });
        if (!t.ok) { onState(it.id, { status: 'error', error: t.error }); continue; }
        const bad = await putVideo('listing-videos', t.path, t.token, it.file, (n) => onState(it.id, { status: 'active', pct: n }));
        if (bad) { onState(it.id, { status: 'error', error: bad }); continue; }
        const r = await saveListingVideo({ listingId, path: t.path });
        if (r.ok) { saved++; onState(it.id, { status: 'done' }); } else onState(it.id, { status: 'error', error: r.error });
      }
    } catch {
      onState(it.id, { status: 'error', error: it.kind === 'photo' ? 'Could not read this photo' : 'Lost connection' });
    }
  }
  return { saved };
}
