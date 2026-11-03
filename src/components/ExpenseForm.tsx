'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addExpense } from '@/app/projects/[id]/money/actions';
import { CATS, CAT_CHIP, isCat, type Cat } from '@/lib/expenses';

const KEY = 'jf_expense_cat';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

/** Shrinks a phone photo to about 1600 px on the long side so it uploads fast and stays under request limits. */
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

export default function ExpenseForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<Cat>('materials');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (isCat(v)) setCat(v); } catch { /* ignore */ }
    setDate(today());
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('project_id', projectId);
      fd.set('amount', amount);
      fd.set('category', cat);
      fd.set('vendor', vendor);
      fd.set('spent_on', date || today());
      const f = fileRef.current?.files?.[0];
      if (f) fd.set('file', new File([await shrink(f)], 'receipt.jpg', { type: 'image/jpeg' }));
      const r = await addExpense(fd);
      if (!r.ok) { setErr(r.error); setBusy(false); return; }
      try { localStorage.setItem(KEY, cat); } catch { /* ignore */ }
      setAmount(''); setVendor(''); setPhoto(''); setDate(today());
      if (fileRef.current) fileRef.current.value = '';
      setOpen(false);
      router.refresh();
    } catch {
      setErr('The receipt photo could not be read. Try again without it, or use a JPEG or PNG.');
    }
    setBusy(false);
  }

  if (!open) return <button className="btn" type="button" onClick={() => setOpen(true)}>+ Add expense</button>;
  return (
    <form onSubmit={save} className="card" aria-label="Add expense">
      <h2>Add expense</h2>
      {err ? <div className="box bad">{err}</div> : null}
      <label className="fld">Amount ($)
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required autoFocus placeholder="612" style={{ fontSize: 28, fontWeight: 800 }} />
      </label>
      <div className="chips" role="radiogroup" aria-label="Type">
        {CATS.map((c) => (
          <label className="chip" key={c}><input type="radio" name="cat" checked={cat === c} onChange={() => setCat(c)} /><span>{CAT_CHIP[c]}</span></label>
        ))}
      </div>
      <label className="fld">Who or where (optional)<input value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={120} placeholder="Home Depot" /></label>
      <label className="fld">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="btn ghost" style={{ cursor: 'pointer' }}>
        {photo ? `📎 ${photo}` : '📷 Take a photo of the receipt'}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => setPhoto(e.target.files?.[0]?.name ? 'Receipt added' : '')} />
      </label>
      <div className="row">
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</button>
        <button className="btn ghost" type="button" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
