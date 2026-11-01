'use client';

import { useRef, useState } from 'react';
import { sendMessage } from '@/app/projects/[id]/actions';

export default function MessageForm({ projectId, otherName, hint }: { projectId: string; otherName: string; hint?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);

  async function action(fd: FormData) {
    setBusy(true);
    try {
      await sendMessage(fd);
      ref.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={ref} action={action} className="composer">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="chips" role="radiogroup" aria-label="Message type">
        {[
          ['', 'Message'],
          ['update', 'Update'],
          ['question', 'Question'],
          ['decision', 'Decision'],
        ].map(([v, label]) => (
          <label className="chip" key={v || 'none'}>
            <input type="radio" name="tag" value={v} defaultChecked={v === ''} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <textarea name="body" rows={2} required maxLength={4000} aria-label="Message" placeholder={`Message ${otherName}…`} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="muted small">{hint ?? 'Mark agreements as Decision so they are easy to find later.'}</span>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  );
}
