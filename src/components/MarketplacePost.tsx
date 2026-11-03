'use client';

import TradeIcon from '@/components/TradeIcon';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createListing, getReference, type RefResult } from '@/app/marketplace/actions';
import RangeBar from '@/components/RangeBar';
import MediaPicker from '@/components/MediaPicker';
import { tipsFor } from '@/lib/photoTips';
import { uploadMedia, type MediaItem } from '@/lib/uploadMedia';

type Types = Record<string, { size: number; sizeLabel: string; groups: [string, string[]][] }>;
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const digits = (v: string) => parseInt(v.replace(/\D/g, ''), 10) || 0;

export default function MarketplacePost({ types, aiOn }: { types: Types; aiOn: boolean }) {
  const names = Object.keys(types);
  const [type, setType] = useState(names[0]);
  const [picks, setPicks] = useState<string[]>([]);
  const [size, setSize] = useState(String(types[names[0]].size));
  const [zip, setZip] = useState('');
  const [details, setDetails] = useState('');
  const [bmin, setBmin] = useState('');
  const [bmax, setBmax] = useState('');
  const [ref, setRef] = useState<Extract<RefResult, { ok: true }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaErr, setMediaErr] = useState('');
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState('');
  const [postErr, setPostErr] = useState('');
  const [nudge, setNudge] = useState(false);
  const skipPhotos = useRef(false);
  const formEl = useRef<HTMLFormElement>(null);
  const mediaCard = useRef<HTMLDivElement>(null);

  const changed = () => setRef(null);
  const chooseType = (t: string) => { setType(t); setPicks([]); setSize(String(types[t].size)); changed(); };
  const toggle = (item: string) => { setPicks((p) => (p.includes(item) ? p.filter((x) => x !== item) : [...p, item])); changed(); };

  async function reference() {
    setErr('');
    if (!picks.length) return setErr('Pick at least one item first.');
    if (!/^\d{5}$/.test(zip)) return setErr('Enter your 5-digit ZIP code first.');
    setBusy(true);
    const r = await getReference({ jobType: type, items: picks, size: parseInt(size.replace(/\D/g, ''), 10) || null, zip, details });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setRef(r);
    setBmin(String(r.ref.low));
    setBmax(String(r.ref.high));
  }


  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (posting) return;
    // Once, and only when there are no photos or videos: a gentle nudge. Publishing is never blocked.
    if (!media.length && !skipPhotos.current) { setNudge(true); return; }
    setPostErr('');
    setPosting(true);
    setStatus('Publishing your project…');
    try {
      const r = await createListing(new FormData(e.currentTarget));
      if (!r.ok) { setPostErr(r.error); setPosting(false); return; }
      let tail = '';
      if (media.length) {
        const u = await uploadMedia(r.id, media, setStatus);
        if (u.errors.length) tail = '&media=partial';
      }
      router.push(`/marketplace/${r.id}?posted=1${tail}`);
    } catch {
      setPostErr('Something went wrong. Check your connection and try again.');
      setPosting(false);
    }
  }

  // Compares the homeowner's budget with the AI range, once a reference exists.
  let check: { tone: 'ok' | 'warn'; text: string } | null = null;
  if (ref) {
    const lo = digits(bmin);
    const hi = digits(bmax);
    const top = hi || lo;
    if (top) {
      if (top < ref.ref.low) check = { tone: 'warn', text: 'Your budget is below the typical range. Contractors may bid higher, or ask to trim the scope.' };
      else if ((lo && lo > ref.ref.high) || top > ref.ref.high * 1.15) check = { tone: 'ok', text: 'Your budget is above the typical range. You may get room for upgrades or a cushion for surprises.' };
      else check = { tone: 'ok', text: 'Your budget is inside the typical range for this scope.' };
    }
  }

  return (
    <form ref={formEl} onSubmit={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input type="hidden" name="job_type" value={type} />
      {picks.map((p) => <input key={p} type="hidden" name="items" value={p} />)}
      {ref ? <input type="hidden" name="ref_id" value={ref.id} /> : null}

      <div className="card">
        <h2>What kind of job?</h2>
        <div className="chips" role="radiogroup" aria-label="Job type">
          {names.map((n) => (
            <label className="chip" key={n}><input type="radio" name="_type" checked={type === n} onChange={() => chooseType(n)} /><span><TradeIcon trade={n} size={18} />{n}</span></label>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Tap what you want done</h2>
        {types[type].groups.map(([group, items]) => (
          <fieldset key={group} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
            <legend className="small muted" style={{ marginBottom: 6 }}>{group}</legend>
            <div className="chips">
              {items.map((it) => (
                <label className="chip" key={it}><input type="checkbox" checked={picks.includes(it)} onChange={() => toggle(it)} /><span>{it}</span></label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="box" style={{ background: 'var(--surface-2)' }}>
          <b>Your scope ({picks.length} selected)</b>
          <div className="small muted" style={{ whiteSpace: 'pre-line' }}>{picks.length ? picks.map((p) => `• ${p}`).join('\n') : 'Nothing picked yet.'}</div>
        </div>
        <div className="grid2">
          <label className="fld">{types[type].sizeLabel}<input name="size" inputMode="numeric" value={size} onChange={(e) => { setSize(e.target.value); changed(); }} /></label>
          <label className="fld">ZIP code<input name="zip" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => { setZip(e.target.value.replace(/\D/g, '')); changed(); }} placeholder="75074" /></label>
          <label className="fld">City (optional)<input name="city" maxLength={80} placeholder="Plano" /></label>
        </div>
        <label className="fld">Anything else? (optional)
          <textarea name="details" rows={3} maxLength={1000} value={details} onChange={(e) => { setDetails(e.target.value); changed(); }} placeholder="Example: I want to start in January. Dogs at home." />
        </label>
      </div>

      <div className="card" ref={mediaCard}>
        <h2>Photos and videos <span className="muted small" style={{ fontWeight: 400 }}>(optional)</span></h2>
        <p className="muted small" style={{ margin: 0 }}>Show contractors the space. A short walk-through video often gets more accurate bids.</p>
        <MediaPicker tips={tipsFor(type)} items={media} setItems={setMedia} onProblem={setMediaErr} disabled={posting} />
        {mediaErr ? <div className="box bad">{mediaErr}</div> : null}
        <p className="muted small" style={{ margin: 0 }}>Contractors never see your street address. Before you add media, check that house numbers, mail and documents are not in the frame.</p>
      </div>

      {aiOn && (
        <div className="card">
          <h2>AI cost reference</h2>
          <p className="muted small">Get a typical local price range for the scope you picked. It is a reference only, not a quote.</p>
          <div className="row"><button type="button" className="btn ghost" disabled={busy} onClick={reference}>{busy ? 'Checking local pricing…' : '✦ Get AI cost reference'}</button></div>
          {err ? <div className="box bad">{err}</div> : null}
          {ref && (
            <div className="box" style={{ background: 'var(--surface-2)' }}>
              <div className="small muted">Typical range for your scope ({ref.ref.confidence} confidence)</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{money(ref.ref.low)} – {money(ref.ref.high)}</div>
              <RangeBar price={ref.ref.likely} lo={ref.ref.low} hi={ref.ref.high} />
              <div className="small">Most likely about {money(ref.ref.likely)}</div>
              {ref.ref.breakdown.map((b) => (
                <div className="row small" key={b.group} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><span>{b.group}</span><b>{money(b.low)}–{money(b.high)}</b></div>
              ))}
              {ref.ref.notes ? <p className="muted small">{ref.ref.notes}</p> : null}
            </div>
          )}
        </div>
      )}
      {!aiOn && err ? <div className="box bad">{err}</div> : null}

      <div className="card">
        <h2>Your budget (optional)</h2>
        <div className="grid2">
          <label className="fld">From<input name="budget_min" inputMode="numeric" value={bmin} onChange={(e) => setBmin(e.target.value)} placeholder="$20,000" /></label>
          <label className="fld">To<input name="budget_max" inputMode="numeric" value={bmax} onChange={(e) => setBmax(e.target.value)} placeholder="$30,000" /></label>
        </div>
        {check ? <div className={`box ${check.tone}`}>{check.text}</div> : null}
        {!ref && aiOn ? <p className="muted small">Tap the AI cost reference button above and these fill in for you. You can change them.</p> : null}
        <h2>Address and details</h2>
        <label className="fld">Street address (optional)<input name="address" maxLength={200} autoComplete="street-address" /></label>
        <p className="muted small">Contractors never see your street address. It is shared only with the contractor you hire.</p>
        <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <input type="checkbox" name="is_homestead" />
          <span>This is my homestead.<span className="muted small" style={{ display: 'block' }}>Texas has extra contract rules for homestead jobs. Jobfile will track them.</span></span>
        </label>
        {nudge && !media.length ? (
          <div className="card" role="alertdialog" aria-label="No photos yet" style={{ gap: 10 }}>
            <b>No photos yet</b>
            <p className="muted small" style={{ margin: 0 }}>Contractors price more accurately when they can see the space. You can still publish now and add photos later from the project page.</p>
            <button type="button" className="btn ghost" onClick={() => { setNudge(false); mediaCard.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>Add photos first</button>
            <button type="button" className="btn" onClick={() => { skipPhotos.current = true; setNudge(false); formEl.current?.requestSubmit(); }}>Publish without photos</button>
          </div>
        ) : null}
        {postErr ? <div className="box bad">{postErr}</div> : null}
        <div className="row"><button className="btn" type="submit" disabled={posting}>{posting ? status || 'Publishing…' : 'Publish project'}</button></div>
        <p className="muted small">Contractors on Jobfile can then send you bids. You choose who to hire. Your project stays open for 30 days.</p>
      </div>
    </form>
  );
}
