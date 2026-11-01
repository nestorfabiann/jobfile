'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { Result } from '@/app/admin/actions';

function Submit({ label, danger }: { label: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={danger ? 'btn accent' : 'btn'} disabled={pending}>
      {pending ? 'Working…' : label}
    </button>
  );
}

function Note({ r }: { r: Result | null }) {
  if (!r) return null;
  return <p role="status" className={r.ok ? 'small' : 'small'} style={{ color: r.ok ? 'var(--ok)' : 'var(--bad)' }}>{r.ok ? r.message : r.error}</p>;
}

type Action = (prev: Result | null, f: FormData) => Promise<Result>;

export function BanForm({ userId, banned, action }: { userId: string; banned: boolean; action: Action }) {
  const [r, run] = useFormState(action, null);
  return (
    <form action={run} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input type="hidden" name="user_id" value={userId} />
      {!banned && <input name="reason" placeholder="Reason (kept in the audit log)" maxLength={500} required />}
      <Submit label={banned ? 'Restore account' : 'Suspend account'} danger={!banned} />
      <Note r={r} />
    </form>
  );
}

export function MessageForm({
  action,
  audience,
  target,
  showAudience,
  users,
  projects,
}: {
  action: Action;
  audience?: string;
  target?: string;
  showAudience?: boolean;
  users?: { id: string; label: string }[];
  projects?: { id: string; label: string }[];
}) {
  const [r, run] = useFormState(action, null);
  return (
    <form action={run} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {showAudience ? (
        <>
          <label>
            Send to
            <select name="audience" defaultValue={audience ?? 'everyone'}>
              <option value="everyone">Everyone</option>
              <option value="contractors">All contractors</option>
              <option value="homeowners">All homeowners</option>
              <option value="project">Everyone on one project</option>
              <option value="user">One person</option>
            </select>
          </label>
          <label>
            Project or person (only for the last two choices)
            <select name="target" defaultValue="">
              <option value="">—</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>Project: {p.label}</option>
              ))}
              {users?.map((u) => (
                <option key={u.id} value={u.id}>Person: {u.label}</option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <input type="hidden" name="audience" value={audience} />
          <input type="hidden" name="target" value={target} />
        </>
      )}
      <input name="title" placeholder="Subject" maxLength={120} required />
      <textarea name="body" placeholder="Message" rows={5} maxLength={2000} required />
      <label className="row small">
        <input type="checkbox" name="force" /> Email even if they turned alerts off (use for account or safety notices)
      </label>
      <Submit label="Send" />
      <Note r={r} />
    </form>
  );
}
