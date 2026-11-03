'use client';

import type { MediaItem, FileState } from '@/lib/uploadMedia';

/** Per-file upload tiles with an overall bar. Failed files get a Retry button. */
export default function UploadProgress({ items, states, onRetry, onSkip, skipLabel }: { items: MediaItem[]; states: Record<string, FileState>; onRetry: (id: string) => void; onSkip: () => void; skipLabel?: string }) {
  const st = (id: string): FileState => states[id] ?? { status: 'wait' };
  const done = items.filter((i) => st(i.id).status === 'done').length;
  const failed = items.filter((i) => st(i.id).status === 'error').length;
  const active = items.some((i) => st(i.id).status === 'active');
  const overall = items.length ? Math.round(((done + items.filter((i) => st(i.id).status === 'active').reduce((s, i) => s + (st(i.id).pct ?? 0) / 100, 0)) / items.length) * 100) : 0;
  const finished = !active && done + failed === items.length;
  return (
    <div className="card" role="status" aria-live="polite" style={{ gap: 12 }}>
      <h2>{finished ? (failed ? 'Almost done' : 'All uploaded') : 'Publishing your project'}</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 14 }}>
        <span>{finished ? `${done} of ${items.length} uploaded` : `Uploading ${Math.min(done + 1, items.length)} of ${items.length}`}</span>
        {failed ? <span className="muted small">{failed} need{failed === 1 ? 's' : ''} attention</span> : null}
      </div>
      <div style={{ height: 8, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${overall}%`, background: 'var(--accent)', transition: 'width .3s' }} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {items.map((i) => {
          const s = st(i.id);
          return (
            <div key={i.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', background: '#3a3f48' }}>
              {i.kind === 'photo' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <video src={`${i.url}#t=0.1`} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {s.status === 'done' ? <span aria-label="Uploaded" style={{ position: 'absolute', top: 5, left: 5, width: 22, height: 22, borderRadius: '50%', background: 'var(--ok)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13 }}>✓</span> : null}
              {s.status === 'wait' ? <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>Waiting</div> : null}
              {s.status === 'active' ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4, padding: 6, color: '#fff', fontSize: 11.5, fontWeight: 600, background: 'linear-gradient(transparent 40%, rgba(0,0,0,.65))' }}>
                  <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,.3)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${i.kind === 'video' ? s.pct ?? 0 : 60}%`, background: '#fff', transition: 'width .2s' }} /></div>
                  {i.kind === 'video' ? `Video ${s.pct ?? 0}%` : 'Uploading…'}
                </div>
              ) : null}
              {s.status === 'error' ? (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(122,26,20,.85)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 4, textAlign: 'center', fontSize: 11.5, fontWeight: 600 }}>
                  {s.error && s.error.length < 40 ? s.error : 'Did not upload'}
                  <button type="button" onClick={() => onRetry(i.id)} style={{ border: 0, background: '#fff', color: '#7a1a14', borderRadius: 99, minHeight: 30, padding: '0 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Retry</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {!finished ? <div className="box" style={{ background: 'var(--surface-2)' }}>Keep this page open until it finishes. Videos take the longest. Your project is already saved, so you will not lose it.</div> : null}
      {failed && finished ? (
        <>
          <div className="box bad">{failed === 1 ? 'One file did not upload.' : `${failed} files did not upload.`} Tap Retry on it. Everything else is saved.</div>
          <button type="button" className="btn ghost" onClick={onSkip}>{skipLabel ?? 'Continue without it'}</button>
        </>
      ) : null}
    </div>
  );
}
