'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { shrink } from './BusinessUploaders';
import { reportIssue, uploadIssuePhoto } from '@/app/projects/[id]/issues/actions';

const MAX = 6;

async function sendPhotos(projectId: string, issueId: string, files: File[], onProgress: (n: number) => void): Promise<string> {
  let failed = '';
  for (let i = 0; i < files.length; i++) {
    onProgress(i + 1);
    try {
      const blob = await shrink(files[i], 1600);
      const fd = new FormData();
      fd.set('project_id', projectId);
      fd.set('issue_id', issueId);
      fd.set('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      const r = await uploadIssuePhoto(fd);
      if (!r.ok) failed = r.error;
    } catch {
      failed = 'One photo could not be read.';
    }
  }
  return failed;
}

/** Report form: writes the report, then uploads the photos one at a time, then opens the problem. */
export function ReportIssueForm({ projectId, otherName, categories, wants, respondDays }: { projectId: string; otherName: string; categories: [string, string][]; wants: [string, string][]; respondDays: number }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [n, setN] = useState(0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const files = Array.from(ref.current?.files ?? []).slice(0, MAX);
    setErr('');
    setBusy('Sending…');
    const fd = new FormData(form);
    fd.delete('photos');
    fd.set('project_id', projectId);
    const r = await reportIssue(fd);
    if (!r.ok) { setBusy(''); setErr(r.error); return; }
    let note = 'Sent. They have 3 days to answer.';
    if (files.length) {
      setBusy(`Adding photos…`);
      const failed = await sendPhotos(projectId, r.id, files, (k) => setBusy(`Adding photo ${k} of ${files.length}…`));
      if (failed) note = `Sent, but a photo did not upload: ${failed} You can add it on the next page.`;
    }
    router.push(`/projects/${projectId}/issues/${r.id}?ok=${encodeURIComponent(note)}`);
  }

  return (
    <form onSubmit={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small" style={{ fontWeight: 700, marginBottom: 6 }}>What kind of problem?</legend>
        <div className="chips">
          {categories.map(([k, l], i) => <label className="chip" key={k}><input type="radio" name="category" value={k} defaultChecked={i === 0} /><span>{l}</span></label>)}
        </div>
      </fieldset>
      <label className="fld">What happened
        <textarea name="description" rows={4} maxLength={2000} required placeholder="Say what you saw, when, and what you already tried." />
      </label>
      <label className="fld">Photos (helps a lot, up to {MAX})
        <input ref={ref} name="photos" type="file" accept="image/*" multiple onChange={(e) => setN(Math.min(MAX, e.target.files?.length ?? 0))} />
        {n > 0 ? <span className="muted small">{n} photo{n === 1 ? '' : 's'} chosen</span> : null}
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small" style={{ fontWeight: 700, marginBottom: 6 }}>What would feel fair? (optional)</legend>
        <div className="chips">
          <label className="chip"><input type="radio" name="wants" value="" defaultChecked /><span>Not sure</span></label>
          {wants.map(([k, l]) => <label className="chip" key={k}><input type="radio" name="wants" value={k} /><span>{l}</span></label>)}
        </div>
      </fieldset>
      {err ? <div className="box warn" role="alert">{err}</div> : null}
      <button className="btn" type="submit" disabled={!!busy}>{busy || `Send to ${otherName}`}</button>
      <p className="muted small" style={{ margin: 0 }}>{otherName} has {respondDays} days to answer. Messages, photos and payments stay on the project record.</p>
    </form>
  );
}

/** Add more photos to an open problem. */
export function IssuePhotoAdder({ projectId, issueId }: { projectId: string; issueId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  async function go() {
    const files = Array.from(ref.current?.files ?? []).slice(0, MAX);
    if (!files.length) return;
    setMsg('');
    const failed = await sendPhotos(projectId, issueId, files, (k) => setBusy(`Adding photo ${k} of ${files.length}…`));
    setBusy('');
    if (ref.current) ref.current.value = '';
    setMsg(failed || 'Added.');
    router.refresh();
  }
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="fld">Add photos
        <input ref={ref} type="file" accept="image/*" multiple onChange={go} disabled={!!busy} />
      </label>
      {busy ? <span className="muted small" role="status">{busy}</span> : msg ? <span className="muted small" role="status">{msg}</span> : null}
    </div>
  );
}
