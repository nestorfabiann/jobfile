'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { Result } from '@/app/admin/actions';

type Action = (prev: Result | null, f: FormData) => Promise<Result>;
function B({ label, value, cls = 'btn' }: { label: string; value: string; cls?: string }) {
  const { pending } = useFormStatus();
  return <button className={cls} name="decision" value={value} disabled={pending}>{pending ? 'Working…' : label}</button>;
}

export default function AdminInsuranceActions({ id, review }: { id: string; review: Action }) {
  const [res, run] = useFormState(review, null);
  return (
    <form action={run} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input type="hidden" name="id" value={id} />
      <input name="note" placeholder="Note to contractor (required if you reject)" maxLength={300} />
      <div className="row"><B label="Approve" value="approved" /><B label="Reject" value="rejected" cls="btn ghost" /></div>
      {res && <p role="status" className="small" style={{ color: res.ok ? 'var(--ok)' : 'var(--bad)' }}>{res.ok ? res.message : res.error}</p>}
    </form>
  );
}
