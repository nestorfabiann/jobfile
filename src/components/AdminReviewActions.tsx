'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { Result } from '@/app/admin/actions';

type Action = (prev: Result | null, f: FormData) => Promise<Result>;
function B({ label, cls = 'btn' }: { label: string; cls?: string }) {
  const { pending } = useFormStatus();
  return <button className={cls} disabled={pending}>{pending ? 'Working…' : label}</button>;
}

export default function AdminReviewActions({ id, hidden, reported, hide, restore }: { id: string; hidden: boolean; reported: boolean; hide: Action; restore: Action }) {
  const [a, runHide] = useFormState(hide, null);
  const [b, runRestore] = useFormState(restore, null);
  const note = a ?? b;
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!hidden && (
        <form action={runHide} className="row" style={{ flexWrap: 'wrap' }}>
          <input type="hidden" name="review_id" value={id} />
          <input name="reason" placeholder="Reason for hiding (saved in the audit log)" required style={{ flex: 1, minWidth: 200 }} />
          <B label="Hide review" />
        </form>
      )}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {hidden && (
          <form action={runRestore}><input type="hidden" name="review_id" value={id} /><B label="Restore review" cls="btn ghost" /></form>
        )}
        {reported && !hidden && (
          <form action={runRestore}><input type="hidden" name="review_id" value={id} /><input type="hidden" name="dismiss" value="1" /><B label="Keep visible (dismiss report)" cls="btn ghost" /></form>
        )}
      </div>
      {note && <p role="status" className="small" style={{ color: note.ok ? 'var(--ok)' : 'var(--bad)' }}>{note.ok ? note.message : note.error}</p>}
    </div>
  );
}
