'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { finishPhase, reactScope, setScopePhase, setScopeStatus } from '@/app/projects/[id]/overview/scopeActions';
import { uploadPhoto } from '@/app/projects/[id]/photos/actions';

export type ScopeLine = { kind: 'item' | 'co'; id: string; title: string; status: 'not_started' | 'in_progress' | 'done'; doneOn: string | null; photoUrl: string | null; reaction: 'ok' | 'question' | null; note: string; phaseId: string | null; auto?: boolean };
export type ScopePhase = { id: string; title: string; status: string; co?: boolean };

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

export default function ScopeCard({ projectId, role, lines: serverLines, phases: serverPhases }: { projectId: string; role: 'contractor' | 'homeowner'; lines: ScopeLine[]; phases: ScopePhase[] }) {
  const router = useRouter();
  // The card updates right away on this screen, and the page data catches up in the background.
  const [lines, setLines] = useState(serverLines);
  useEffect(() => { setLines(serverLines); }, [serverLines]);
  const [phases, setPhases] = useState(serverPhases);
  useEffect(() => { setPhases(serverPhases); }, [serverPhases]);
  const [skip, setSkip] = useState<string[]>([]);
  const patch = (l: ScopeLine, p: Partial<ScopeLine>) => setLines((cur) => cur.map((x) => (x.kind === l.kind && x.id === l.id ? { ...x, ...p } : x)));
  // Keeps the page where it is while an action and its refresh run. Next.js can move the page during a refresh,
  // so for a few seconds the place is put back every frame, until the person touches or scrolls the screen.
  const hold = () => {
    const y = window.scrollY;
    const end = Date.now() + 6000;
    let stop = false;
    const off = () => { stop = true; };
    const evs = ['touchstart', 'wheel', 'keydown', 'mousedown'] as const;
    evs.forEach((e) => window.addEventListener(e, off, { once: true, passive: true }));
    const tick = () => {
      if (stop || Date.now() > end) { evs.forEach((e) => window.removeEventListener(e, off)); return; }
      if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const sync = () => { hold(); router.refresh(); };
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [asking, setAsking] = useState('');
  const [q, setQ] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<ScopeLine | null>(null);
  const done = lines.filter((l) => l.status === 'done').length;
  const pct = lines.length ? Math.round((done / lines.length) * 100) : 0;
  const key = (l: ScopeLine) => `${l.kind}:${l.id}`;

  async function set(l: ScopeLine, to: 'not_started' | 'in_progress' | 'done', photoId?: string) {
    hold(); setBusy(key(l)); setErr('');
    const r = await setScopeStatus({ projectId, kind: l.kind, id: l.id, to, photoId });
    setBusy('');
    if (!r.ok) setErr(r.error);
    else {
      patch(l, to === 'done' ? { status: 'done', doneOn: 'today' } : { status: to, doneOn: null, reaction: null, note: '' });
      sync();
    }
  }
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const l = pending.current; const f = e.target.files?.[0];
    e.target.value = '';
    if (!l) return;
    if (!f) return void set(l, 'done');
    hold(); setBusy(key(l)); setErr('');
    let photoId: string | undefined;
    try {
      const blob = await shrink(f);
      const fd = new FormData();
      fd.set('project_id', projectId); fd.set('kind', 'progress'); fd.set('caption', l.title.slice(0, 200));
      fd.set('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      const r = await uploadPhoto(fd);
      if (r.ok) photoId = r.id; else setErr(r.error);
    } catch { setErr('That photo could not be read. The line was still marked done.'); }
    await set(l, 'done', photoId);
  }
  async function react(l: ScopeLine, reaction: 'ok' | 'question', note?: string) {
    hold(); setBusy(key(l)); setErr('');
    const r = await reactScope({ projectId, kind: l.kind, id: l.id, reaction, note });
    setBusy('');
    if (!r.ok) return void setErr(r.error);
    patch(l, { reaction, note: reaction === 'question' ? (note ?? '') : '' });
    setAsking(''); setQ(''); sync();
  }

  async function pickPhase(l: ScopeLine, phaseId: string) {
    hold(); setBusy(key(l)); setErr('');
    const r = await setScopePhase({ projectId, kind: l.kind, id: l.id, phaseId: phaseId || null });
    setBusy('');
    if (!r.ok) return void setErr(r.error);
    patch(l, { phaseId: phaseId || null });
    sync();
  }
  async function closePhase(id: string) {
    hold(); setBusy(`ph:${id}`); setErr('');
    const r = await finishPhase({ projectId, phaseId: id });
    setBusy('');
    if (!r.ok) return void setErr(r.error);
    setPhases((cur) => cur.map((p) => (p.id === id ? { ...p, status: 'done' } : p)));
    sync();
  }
  const known = new Set(phases.map((p) => p.id));
  const tagged = lines.some((l) => l.phaseId && known.has(l.phaseId));
  const isCo = (l: ScopeLine) => !!l.auto;
  const groups: { id: string; title: string; lines: ScopeLine[] }[] = tagged
    ? [
        ...phases.filter((p) => !p.co).map((p) => ({ id: p.id, title: p.title, lines: lines.filter((l) => !isCo(l) && l.phaseId === p.id) })).filter((g) => g.lines.length),
        ...(lines.some((l) => !isCo(l) && (!l.phaseId || !known.has(l.phaseId))) ? [{ id: '', title: 'No phase yet', lines: lines.filter((l) => !isCo(l) && (!l.phaseId || !known.has(l.phaseId))) }] : []),
        ...(lines.some(isCo) ? [{ id: 'co', title: 'Change orders', lines: lines.filter(isCo) }] : []),
      ]
    : [{ id: '', title: '', lines }];
  // Phases that are fully done and still open, for the "Mark phase done" prompt.
  const readyPhases = (g: { id: string; lines: ScopeLine[] }) => {
    if (role !== 'contractor') return [] as ScopePhase[];
    const ids = g.id === 'co' ? Array.from(new Set(g.lines.map((l) => l.phaseId).filter(Boolean) as string[])) : g.id ? [g.id] : [];
    return ids.map((id) => phases.find((p) => p.id === id)).filter((p): p is ScopePhase => !!p && p.status !== 'done' && !skip.includes(p.id)).filter((p) => {
      const ls = lines.filter((l) => l.phaseId === p.id);
      return ls.length > 0 && ls.every((l) => l.status === 'done');
    });
  };

  return (
    <section className="card sc-card" id="scope" aria-label="Scope of work">
      <div className="sc-hd"><h2>Scope of work</h2><b>{done} of {lines.length} done</b></div>
      <div className="sc-bar" role="img" aria-label={`${pct} percent of the scope is done`}><i style={{ width: `${pct}%` }} /></div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} aria-label="Add a photo of the finished work" />
      {err ? <div className="box warn" role="alert">{err}</div> : null}
      {groups.map((g) => {
        const doneN = g.lines.filter((l) => l.status === 'done').length;
        return (
          <div key={g.id || 'none'} className={tagged ? 'sc-grp' : undefined}>
            {tagged ? <div className="sc-gh"><span>{g.title}</span><span>{doneN} of {g.lines.length}</span></div> : null}
            {tagged ? readyPhases(g).map((rp) => (
              <div key={rp.id} className="box warn sc-pp">
                <b>All scope lines in &ldquo;{rp.title}&rdquo; are done.</b>
                <div className="sc-act"><button type="button" className="sc-b pr" disabled={!!busy} onClick={() => closePhase(rp.id)}>{busy === `ph:${rp.id}` ? 'Saving…' : 'Mark phase done'}</button><button type="button" className="sc-b" onClick={() => setSkip((x) => [...x, rp.id])}>Not yet</button></div>
              </div>
            )) : null}
        {g.lines.map((l) => {
        const k = key(l);
        return (
          <div className="sc-ln" key={k}>
            <span className={`sc-ck ${l.status === 'done' ? 'd' : l.status === 'in_progress' ? 'p' : ''}`} aria-hidden="true">{l.status === 'done' ? '✓' : ''}</span>
            <div className="sc-tx">
              <b>{l.title}</b>
              <small>
                {l.status === 'done' ? `Done${l.doneOn ? (l.doneOn === 'today' ? ' just now' : ` ${l.doneOn}`) : ''}${l.reaction === 'ok' ? ' · Homeowner said looks good' : ''}` : l.status === 'in_progress' ? 'In progress' : 'Not started'}
                {l.kind === 'co' ? ' · Added by change order' : ''}
              </small>
              {l.reaction === 'question' ? <div className="sc-q">{role === 'homeowner' ? 'You asked' : 'Homeowner asked'}: {l.note}{role === 'homeowner' ? ' (sent in Messages)' : ' (see Messages)'}</div> : null}
              {role === 'contractor' ? (
                <div className="sc-act">
                  {l.status !== 'done' ? <button type="button" className="sc-b pr" disabled={!!busy} onClick={() => { pending.current = l; fileRef.current?.click(); }}>{busy === k ? 'Saving…' : 'Done + photo'}</button> : null}
                  {l.status !== 'done' ? <button type="button" className="sc-b" disabled={!!busy} onClick={() => set(l, 'done')}>Done only</button> : null}
                  {l.status === 'not_started' ? <button type="button" className="sc-b" disabled={!!busy} onClick={() => set(l, 'in_progress')}>Start</button> : null}
                  {l.status !== 'not_started' ? <button type="button" className="sc-b" disabled={!!busy} onClick={() => set(l, l.status === 'done' ? 'in_progress' : 'not_started')}>{l.status === 'done' ? 'Undo' : 'Reset'}</button> : null}
                  {phases.some((p) => !p.co) && !l.auto ? (
                    <label className="sc-ph">Phase
                      <select className="sc-sel" aria-label={`Phase for ${l.title}`} value={l.phaseId && known.has(l.phaseId) ? l.phaseId : ''} disabled={!!busy} onChange={(e) => pickPhase(l, e.target.value)}>
                        <option value="">None</option>
                        {phases.filter((p) => !p.co).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
              ) : l.status === 'done' && !l.reaction ? (
                asking === k ? (
                  <div className="sc-ask">
                    <label className="fld" htmlFor={`q-${k}`}>Your question for the contractor<input id={`q-${k}`} value={q} maxLength={400} onChange={(e) => setQ(e.target.value)} placeholder="Example: Is that the color we picked?" /></label>
                    <div className="sc-act"><button type="button" className="sc-b pr" disabled={!!busy} onClick={() => react(l, 'question', q)}>Send question</button><button type="button" className="sc-b" onClick={() => setAsking('')}>Cancel</button></div>
                  </div>
                ) : (
                  <div className="sc-act"><button type="button" className="sc-b" disabled={!!busy} onClick={() => react(l, 'ok')}>Looks good</button><button type="button" className="sc-b" onClick={() => { setAsking(k); setQ(''); }}>Question</button></div>
                )
              ) : null}
            </div>
            {l.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sc-th" src={l.photoUrl} alt={`Finished: ${l.title}`} loading="lazy" />
            ) : null}
          </div>
        );
      })}
          </div>
        );
      })}
    </section>
  );
}
