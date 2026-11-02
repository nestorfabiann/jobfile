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

/** Uploads photos through the server (they are shrunk first) and videos straight to storage. Never throws. */
export async function uploadMedia(listingId: string, items: { kind: 'photo' | 'video'; file: File }[], onStatus: (text: string) => void) {
  let saved = 0;
  const errors: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    onStatus(`Uploading ${i + 1} of ${items.length}${it.kind === 'video' ? ' (video, this can take a minute)' : ''}…`);
    try {
      if (it.kind === 'photo') {
        const fd = new FormData();
        fd.set('listing_id', listingId);
        fd.set('file', new File([await shrinkImage(it.file)], 'photo.jpg', { type: 'image/jpeg' }));
        const r = await uploadListingPhoto(fd);
        if (r.ok) saved++;
        else errors.push(r.error);
      } else {
        const t = await videoUploadUrl({ listingId, contentType: it.file.type, size: it.file.size });
        if (!t.ok) { errors.push(t.error); continue; }
        const up = await supabaseBrowser().storage.from('listing-videos').uploadToSignedUrl(t.path, t.token, it.file, { contentType: it.file.type });
        if (up.error) { errors.push('A video could not be uploaded. Check your connection and try again.'); continue; }
        const r = await saveListingVideo({ listingId, path: t.path });
        if (r.ok) saved++;
        else errors.push(r.error);
      }
    } catch {
      errors.push(it.kind === 'photo' ? 'One photo could not be read. Try a JPEG or PNG.' : 'A video could not be uploaded.');
    }
  }
  return { saved, errors: Array.from(new Set(errors)) };
}
