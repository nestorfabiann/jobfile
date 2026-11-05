'use client';

import { useState } from 'react';
import { deleteDraft } from '@/app/marketplace/actions';

/** A quiet red Delete link. Tapping it opens a red confirmation before anything is removed. */
export default function DraftDelete({ id, back }: { id: string; back: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 0, color: 'var(--bad, #b3412f)', fontWeight: 600, fontSize: 14, padding: '10px 6px', cursor: 'pointer' }}>Delete</button>;
  }
  return (
    <div role="alertdialog" aria-label="Delete this draft" style={{ flexBasis: '100%', background: 'var(--bad-bg, #fbeae6)', border: '1px solid var(--bad-line, #efc3ba)', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <b style={{ color: 'var(--bad, #8f2f20)' }}>Delete this draft?</b>
      <span className="small" style={{ color: 'var(--bad, #8f2f20)' }}>This removes the draft for good.</span>
      <form action={deleteDraft} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="back" value={back} />
        <button className="btn" type="submit" style={{ background: '#b3412f', borderColor: '#b3412f', color: '#fff', flex: 1 }}>Yes, delete the draft</button>
        <button className="btn ghost" type="button" onClick={() => setOpen(false)} style={{ flex: 1 }}>Keep it</button>
      </form>
    </div>
  );
}
