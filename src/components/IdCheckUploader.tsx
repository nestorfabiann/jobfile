'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitIdCheck, type IdResult } from '@/app/settings/business/idActions';
import { shrink } from './BusinessUploaders';

const FLAG_TEXT: Record<string, string> = {
  not_read: 'We could not read it automatically, so an admin will look at it.',
  not_an_id: 'This does not look like a driver license or state ID.',
  blurry: 'Part of it is blurry or covered by glare. A sharper photo gets approved faster.',
  screen_photo: 'This looks like a photo of a screen or a printout. Use the real card.',
  looks_edited: 'Something looks edited. An admin will take a closer look.',
  no_expiry: 'We could not read the expiry date.',
  expired: 'This ID looks expired.',
  name_close: 'The name on the ID is close to your account name but not exact.',
  name_differs: 'The name on the ID is different from the name on your account. Update your name in Settings if it is wrong.',
};

export default function IdCheckUploader() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<IdResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const f = ref.current?.files?.[0];
    if (!f) return setRes({ ok: false, error: 'Choose a photo of your ID.' });
    setBusy(true);
    setRes(null);
    try {
      const blob = await shrink(f, 1800);
      const fd = new FormData();
      fd.set('file', new File([blob], 'id.jpg', { type: 'image/jpeg' }));
      const r = await submitIdCheck(fd);
      setRes(r);
      if (r.ok) { if (ref.current) ref.current.value = ''; router.refresh(); }
    } catch {
      setRes({ ok: false, error: 'That photo could not be read. Try another.' });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="fld">
        Photo of your driver license or state ID (front)
        <input ref={ref} type="file" accept="image/*" capture="environment" />
      </label>
      <button className="btn" disabled={busy}>{busy ? 'Reading your ID…' : 'Send for checking'}</button>
      <p className="muted small" style={{ margin: 0 }}>To read your ID, the photo is processed by an AI service. Only Jobfile admins can open it, and it is deleted as soon as it is checked. We keep only the date it was verified.</p>
      {res && !res.ok && <div className="box bad" role="status">{res.error}</div>}
      {res && res.ok && (
        <div className="box ok" role="status">
          <b>Sent for checking.</b>
          {res.read && <div className="small">We read: {res.name || 'name unclear'}{res.expires ? ` · expires ${res.expires}` : ''}</div>}
          {res.flags.map((x) => FLAG_TEXT[x] ? <div className="small" key={x}>• {FLAG_TEXT[x]}</div> : null)}
        </div>
      )}
    </form>
  );
}
