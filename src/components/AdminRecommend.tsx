'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { Result } from '@/app/admin/actions';

type Action = (prev: Result | null, f: FormData) => Promise<Result>;
function Go() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? 'Sending…' : 'Send to both sides'}</button>;
}

/** Owner writes a non-binding recommendation on a reported problem. */
export default function AdminRecommend({ id, send }: { id: string; send: Action }) {
  const [res, run] = useFormState(send, null);
  return (
    <form action={run} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input type="hidden" name="id" value={id} />
      <label className="fld">Your recommendation (not binding)
        <textarea name="note" rows={3} maxLength={1500} placeholder="For example: redo the wall by Nov 17, with a photo check on the 18th." />
      </label>
      <div className="row"><Go /></div>
      {res && <p role="status" className="small" style={{ color: res.ok ? 'var(--ok)' : 'var(--bad)' }}>{res.ok ? res.message : res.error}</p>}
    </form>
  );
}
