'use client';

import VisitPrefFields from '@/components/VisitPrefFields';
import TradeIcon from '@/components/TradeIcon';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkPost, createListing, getReference, saveDraft, type RefResult } from '@/app/marketplace/actions';
import type { DraftData } from '@/lib/drafts';
import SweepRangeBar from '@/components/SweepRangeBar';
import MediaPicker from '@/components/MediaPicker';
import { tipsFor } from '@/lib/photoTips';
import { uploadMedia, type MediaItem, type FileState } from '@/lib/uploadMedia';
import UploadProgress from '@/components/UploadProgress';
import { optionsOf, questionsFor, readiness, type Answers } from '@/lib/scopeQuestions';

type Types = Record<string, { size: number; sizeLabel: string; groups: [string, string[]][] }>;
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const digits = (v: string) => parseInt(v.replace(/\D/g, ''), 10) || 0;

export default function MarketplacePost({ types, aiOn, draft, inviteCompany, inviteName, idea, ideaPicks, leads }: { leads?: { name: string; trades: string[] }[]; ideaPicks?: string[]; idea?: { id: string; pick: number; thumb: string | null; label: string; blurb: string } | null; types: Types; aiOn: boolean; inviteCompany?: string; inviteName?: string; draft?: { id: string; at: string; data: DraftData } | null }) {
  const names = Object.keys(types);
  const d0 = draft?.data;
  const [type, setType] = useState(d0 && types[d0.type] ? d0.type : names[0]);
  const [picks, setPicks] = useState<string[]>(d0?.picks ?? []);
  const [size, setSize] = useState(d0?.size || String(types[d0 && types[d0.type] ? d0.type : names[0]].size));
  const [zip, setZip] = useState(d0?.zip ?? '');
  const [city, setCity] = useState(d0?.city ?? '');
  const [details, setDetails] = useState(d0?.details ?? '');
  const [extra, setExtra] = useState('');
  const [extraOpen, setExtraOpen] = useState(false);
  const [bmin, setBmin] = useState(d0?.bmin ?? '');
  const [bmax, setBmax] = useState(d0?.bmax ?? '');
  const [answers, setAnswers] = useState<Answers>(d0?.answers ?? {});
  const [review, setReview] = useState<{ busy: boolean; error: string; questions: string[] }>({ busy: false, error: '', questions: [] });
  const [saveMsg, setSaveMsg] = useState<{ tone: 'ok' | 'bad' | 'wait'; text: string } | null>(null);
  const draftId = useRef<string | undefined>(draft?.id);
  const lastSaved = useRef('');
  const chain = useRef<Promise<void>>(Promise.resolve());
  const firstRun = useRef(true);
  const [ref, setRef] = useState<Extract<RefResult, { ok: true }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaErr, setMediaErr] = useState('');
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState('');
  const [upStates, setUpStates] = useState<Record<string, FileState>>({});
  const [listingId, setListingId] = useState('');
  const invQ = useRef('');
  const upLive = useRef<Record<string, FileState>>({});
  const [postErr, setPostErr] = useState('');
  const [nudge, setNudge] = useState(false);
  const skipPhotos = useRef(false);
  const formEl = useRef<HTMLFormElement>(null);
  const mediaCard = useRef<HTMLDivElement>(null);

  const changed = () => setRef(null);
  const chooseType = (t: string) => { setType(t); setPicks([]); setAnswers({}); setSize(String(types[t].size)); changed(); };
  const toggle = (item: string) => { setPicks((p) => (p.includes(item) ? p.filter((x) => x !== item) : [...p, item])); changed(); };

  const setAnswer = (k: string, v: string) => setAnswers((a) => { const next = { ...a }; if (v) next[k] = v; else delete next[k]; return next; });
  async function runReview() {
    setReview({ busy: true, error: '', questions: [] });
    const r = await checkPost({ jobType: type, items: picks, answers, size, details });
    setReview(r.ok ? { busy: false, error: '', questions: r.questions } : { busy: false, error: r.error, questions: [] });
  }
  const addToNotes = (q: string) => { setDetails((d) => (d ? d + '\n' : '') + q + ' '); changed(); };

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



  // Saves the form on the server a moment after each change, so nothing is lost if the page closes.
  useEffect(() => {
    if (posting) return;
    const data = { type, picks, size, zip, city, details, bmin, bmax, answers };
    const meaningful = picks.length > 0 || zip !== '' || city !== '' || details !== '' || Object.keys(answers).length > 0;
    const snap = JSON.stringify(data);
    if (firstRun.current) { firstRun.current = false; if (draft) { lastSaved.current = snap; return; } }
    if (!meaningful || snap === lastSaved.current) return;
    const t = setTimeout(() => {
      setSaveMsg({ tone: 'wait', text: 'Saving…' });
      chain.current = chain.current.then(async () => {
        try {
          const r = await saveDraft({ id: draftId.current, data });
          if (r.ok) { draftId.current = r.id; lastSaved.current = snap; setSaveMsg({ tone: 'ok', text: 'Draft saved' }); }
          else setSaveMsg({ tone: 'bad', text: r.error });
        } catch {
          setSaveMsg({ tone: 'bad', text: 'Could not save the draft. Check your connection.' });
        }
      });
    }, 900);
    return () => clearTimeout(t);
  }, [type, picks, size, zip, city, details, bmin, bmax, answers, posting]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formNode = e.currentTarget; // read now: React clears currentTarget after the first await
    if (posting) return;
    if (!answers.when) { setPostErr('Choose when you want to start. It is in the questions above.'); return; }
    // Once, and only when there are no photos or videos: a gentle nudge. Publishing is never blocked.
    if (!media.length && !skipPhotos.current && !idea) { setNudge(true); return; }
    setPostErr('');
    setPosting(true);
    setStatus('Publishing your project…');
    await chain.current; // let any draft save finish first, so it cannot recreate a draft after publishing
    try {
      const fd = new FormData(formNode);
      if (draftId.current) fd.set('draft_id', draftId.current);
      if (inviteCompany) fd.set('invite_company', inviteCompany);
      const r = await createListing(fd);
      if (!r.ok) { setPostErr(r.error); setPosting(false); return; }
      invQ.current = r.invite ? `&inv=${r.invite.ok ? 'ok' : r.invite.why ?? 'other'}&invc=${encodeURIComponent(r.invite.company)}` : '';
      if (media.length) {
        setListingId(r.id);
        setStatus('Uploading…');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await runUploads(r.id, media);
      } else router.push(`/marketplace/${r.id}?posted=1${invQ.current}`);
    } catch (err: any) {
      setPostErr(`Something went wrong. Check your connection and try again. (${String(err?.message ?? err).slice(0, 160)})`);
      setPosting(false);
    }
  }

  function note(id: string, st: FileState) {
    upLive.current = { ...upLive.current, [id]: st };
    setUpStates(upLive.current);
  }
  // Uploads the given files, then leaves for the job page once none are still failing.
  async function runUploads(lid: string, list: MediaItem[]) {
    await uploadMedia(lid, list, note);
    const failed = media.filter((m) => upLive.current[m.id]?.status === 'error').length;
    if (!failed) router.push(`/marketplace/${lid}?posted=1${invQ.current}`);
  }
  const leaveWithFailures = () => router.push(`/marketplace/${listingId}?posted=1&media=partial${invQ.current}`);

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

  const qs = questionsFor(type);
  const detailQs = qs.filter((q) => q.k !== 'when' && q.k !== 'flex');
  const whenQ = qs.find((q) => q.k === 'when');
  const flexQ = qs.find((q) => q.k === 'flex');
  const rd = readiness(type, answers, media.length, picks.length, size);

  return (
    <form ref={formEl} onSubmit={submit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {listingId && media.length ? (
        <UploadProgress items={media} states={upStates} onRetry={(id) => { const it = media.find((m) => m.id === id); if (it) void runUploads(listingId, [it]); }} onSkip={leaveWithFailures} />
      ) : null}
      {saveMsg && !listingId ? (
        <div role="status" className="small" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: saveMsg.tone === 'ok' ? 'var(--ok)' : saveMsg.tone === 'bad' ? 'var(--bad)' : 'var(--accent)' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />{saveMsg.text}
        </div>
      ) : null}
      {draft?.id && !saveMsg ? <div className="box ok">Welcome back. We restored your draft from {new Date(draft.at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Photos and videos need to be added again before you publish.</div> : null}
      <input type="hidden" name="job_type" value={type} />
      {picks.map((p) => <input key={p} type="hidden" name="items" value={p} />)}
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />
      {ref ? <input type="hidden" name="ref_id" value={ref.id} /> : null}
      {idea ? (
        <div className="card" style={{ borderColor: '#ecd4a8', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="hidden" name="idea_id" value={idea.id} />
          <input type="hidden" name="idea_pick" value={idea.pick} />
          <b className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your design idea</b>
          <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
            {idea.thumb ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={idea.thumb} alt="Your AI design idea" style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 12, flex: 'none' }} /> : null}
            <span><b>{idea.label}</b><br /><span className="muted small">{idea.blurb}</span><br /><a href={`/design/${idea.id}`} className="small" style={{ fontWeight: 700 }}>Change idea</a></span>
          </div>
          <label className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><input type="checkbox" name="share_ai" defaultChecked /><span>Show the AI picture to contractors</span></label>
          <label className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><input type="checkbox" name="share_before" defaultChecked /><span>Also show my original photo as the “before”</span></label>
          <p className="muted small" style={{ margin: 0 }}>Only signed-in contractors can see photos. Check there are no people or personal items in the shot. The AI picture is not a plan and not a price.</p>
        </div>
      ) : null}

      <div className="card">
        <h2>What kind of job?</h2>
        <div className="chips" role="radiogroup" aria-label="Job type">
          {names.map((n) => (
            <label className="chip" key={n}><input type="radio" name="_type" checked={type === n} onChange={() => chooseType(n)} /><span><TradeIcon trade={n} size={18} />{n}</span></label>
          ))}
        </div>
      </div>

      {(() => {
        const names = (leads ?? []).filter((c) => c.trades.includes(type)).map((c) => c.name);
        return names.length ? (
          <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
            <b>You started a project with {names.join(' and ')}</b>
            <span className="small" style={{ display: 'block' }}>If you post this kind of job, they are told and can bid with everyone else. Their quote and notes stay private to your project.</span>
          </div>
        ) : null;
      })()}
      <div className="card">
        <h2>Tap what you want done</h2>
        {types[type].groups.map(([group, items]) => (
          <fieldset key={group} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
            <legend className="small muted" style={{ marginBottom: 6 }}>{group}</legend>
            <div className="chips">
              {items.map((it) => (
                <label className="chip" key={it}><input type="checkbox" checked={picks.includes(it)} onChange={() => toggle(it)} /><span>{it}{ideaPicks?.includes(it) ? <small style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, opacity: 0.8 }}>From your idea</small> : null}</span></label>
              ))}
            </div>
          </fieldset>
        ))}
        {extraOpen ? (
          <label className="fld">Something else you want done
            <input name="extra" maxLength={200} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Example: pocket door, built-in shelves" autoFocus />
            <span className="small muted">Contractors will read this. The AI price range only counts the items you tap above.</span>
          </label>
        ) : (
          <button type="button" className="small" style={{ alignSelf: 'flex-start', background: 'none', border: 0, padding: 0, color: 'var(--accent, #c4813f)', fontWeight: 600 }} onClick={() => setExtraOpen(true)}>+ Add something else</button>
        )}
        <div className="box" style={{ background: 'var(--surface-2)' }}>
          <b>Your scope ({picks.length} selected)</b>
          <div className="small muted" style={{ whiteSpace: 'pre-line' }}>{picks.length ? picks.map((p) => `• ${p}`).join('\n') : 'Nothing picked yet.'}</div>
        </div>
        <div className="grid2">
          <label className="fld">{types[type].sizeLabel}<input name="size" inputMode="numeric" value={size} onChange={(e) => { setSize(e.target.value); changed(); }} /></label>
          <label className="fld">ZIP code<input name="zip" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => { setZip(e.target.value.replace(/\D/g, '')); changed(); }} placeholder="75074" /></label>
          <label className="fld">City (optional)<input name="city" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Plano" /></label>
        </div>
        <label className="fld">Anything else? (optional)
          <textarea name="details" rows={3} maxLength={1000} value={details} onChange={(e) => { setDetails(e.target.value); changed(); }} placeholder="Example: I want to start in January. Dogs at home." />
        </label>
      </div>

      <div className="card">
        <h2>When do you want to start? *</h2>
        <p className="muted small" style={{ margin: 0 }}>Contractors see this first. Say if the date can move.</p>
        {whenQ ? (
          <div className="chips" role="group" aria-label={whenQ.label}>
            {(whenQ.options ?? []).map((o) => (
              <label className="chip" key={o}><input type="checkbox" checked={answers.when === o} onChange={() => setAnswer('when', answers.when === o ? '' : o)} /><span>{o === 'Within 2 weeks' ? 'Within 2 weeks (ASAP)' : o}</span></label>
            ))}
          </div>
        ) : null}
        {flexQ ? (
          <>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{flexQ.label}</div>
            <div className="chips" role="group" aria-label={flexQ.label}>
              {(flexQ.options ?? []).map((o) => (
                <label className="chip" key={o}><input type="checkbox" checked={answers.flex === o} onChange={() => setAnswer('flex', answers.flex === o ? '' : o)} /><span>{o}</span></label>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {picks.length > 0 ? (
        <>
          <div className="card" style={{ position: 'sticky', top: 0, zIndex: 5, gap: 6, padding: '10px 14px' }} aria-live="polite">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><b>Ready for bids</b><b>{rd.pct}%</b></div>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${rd.pct}%`, background: rd.pct >= 80 ? 'var(--ok)' : 'var(--accent)', borderRadius: 99, transition: 'width .25s' }} /></div>
            <span className="muted small">{rd.pct >= 80 ? 'Great. Contractors can bid with confidence.' : rd.pct >= 40 ? 'Getting there. Answer a few more for tighter bids.' : 'Answer the questions below. Contractors bid closer when they know more.'}</span>
          </div>
          <div className="card">
            <h2>{type}: the details</h2>
            <p className="muted small" style={{ margin: 0 }}>The questions a contractor would ask on a site visit. Pick &quot;Not sure&quot; when you do not know. Nobody gets stuck.</p>
            {detailQs.map((q, i) => (
              <div key={q.k} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {i === 0 || detailQs[i - 1].group !== q.group ? <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginTop: i ? 8 : 0 }}>{q.group}</div> : null}
                {q.kind === 'number' ? (
                  <label className="fld">{q.label}{q.req ? ' *' : ''}<input inputMode="numeric" maxLength={7} value={answers[q.k] ?? ''} onChange={(e) => setAnswer(q.k, e.target.value.replace(/\D/g, ''))} placeholder={q.placeholder} /></label>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{q.label}{q.req ? ' *' : ''}</div>
                    <div className="chips" role="group" aria-label={q.label}>
                      {optionsOf(q).map((o) => (
                        <label className="chip" key={o}><input type="checkbox" checked={answers[q.k] === o} onChange={() => setAnswer(q.k, answers[q.k] === o ? '' : o)} /><span style={o === 'Not sure' ? { borderStyle: 'dashed' } : undefined}>{o}</span></label>
                      ))}
                    </div>
                  </>
                )}
                {q.hint ? <span className="muted small">{q.hint}</span> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

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
          {busy ? (
            <div className="rx-ex" role="status" aria-live="polite">
              <div className="small">Checking local pricing for your scope…</div>
              <div className="rx-bar rx-scan"><i /><b /></div>
            </div>
          ) : null}
          {!ref && !busy ? (
            <div className="rx-ex" aria-hidden="true">
              <span className="rx-tag">Example</span>
              <div className="rx-big">$8,000 – $14,000</div>
              <div className="rx-bar"><i /><b /></div>
              <div className="small">Most likely about $11,000</div>
              <div className="small muted" style={{ marginTop: 6 }}>Yours is based on the work you picked and your ZIP.</div>
            </div>
          ) : null}
          <div className="row"><button type="button" className={ref ? 'btn ghost' : 'btn accent'} disabled={busy} onClick={reference}>{busy ? 'Checking local pricing…' : ref ? '✦ Get AI cost reference' : '✦ Get my AI cost reference'}</button></div>
          {err ? <div className="box bad">{err}</div> : null}
          {ref && (
            <div className="box" style={{ background: 'var(--surface-2)' }}>
              <div className="small muted">Typical range for your scope ({ref.ref.confidence} confidence)</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{money(ref.ref.low)} – {money(ref.ref.high)}</div>
              <SweepRangeBar price={ref.ref.likely} lo={ref.ref.low} hi={ref.ref.high} />
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

      {picks.length > 0 ? (
        <div className="card">
          <h2>Before it goes live</h2>
          <div className="small">
            {rd.required.map((r) => <div key={r.label}>{r.ok ? '✓' : '○'} {r.label}</div>)}
            <div>{media.length >= 2 ? '✓' : '○'} 2 or more photos {media.length >= 2 ? '' : `(${media.length} added, recommended)`}</div>
          </div>
          {rd.missing.length ? <p className="muted small" style={{ margin: 0 }}>Still open: {rd.missing.slice(0, 5).map((q) => q.short || q.label).join(', ')}{rd.missing.length > 5 ? ` and ${rd.missing.length - 5} more` : ''}. Posts with 80% or more get bids that are closer to the final price.</p> : null}
          {aiOn ? (
            <>
              <button type="button" className="btn ghost" disabled={review.busy} onClick={runReview}>{review.busy ? 'Reading your post…' : '✦ Check my post'}</button>
              <p className="muted small" style={{ margin: 0 }}>Optional. It asks up to three follow-up questions a contractor would ask. It shares the daily AI limit with the cost reference.</p>
              {review.error ? <div className="box bad">{review.error}</div> : null}
              {review.questions.length ? (
                <div className="box" style={{ background: 'var(--surface-2)' }}>
                  <b>Things a contractor would ask</b>
                  {review.questions.map((q, i) => <button key={i} type="button" onClick={() => addToNotes(q)} style={{ display: 'block', textAlign: 'left', background: 'none', border: 0, padding: '6px 0', font: 'inherit', color: 'inherit', cursor: 'pointer' }}>{i + 1}. {q}</button>)}
                  <span className="muted small">Tap a question to add it to your notes above, then answer it there.</span>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

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
        <h2>Site visits</h2>
        <p className="muted small">Contractors often want to see the space before they price it. Tell them what works for you. Your address stays private until you hire.</p>
        <VisitPrefFields />
        <p className="muted small">You can change this later on your project page.</p>
        {nudge && !media.length ? (
          <div className="card" role="alertdialog" aria-label="No photos yet" style={{ gap: 10 }}>
            <b>No photos yet</b>
            <p className="muted small" style={{ margin: 0 }}>Contractors price more accurately when they can see the space. You can still publish now and add photos later from the project page.</p>
            <button type="button" className="btn ghost" onClick={() => { setNudge(false); mediaCard.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>Add photos first</button>
            <button type="button" className="btn" onClick={() => { skipPhotos.current = true; setNudge(false); formEl.current?.requestSubmit(); }}>Publish without photos</button>
          </div>
        ) : null}
        {postErr ? <div className="box bad">{postErr}</div> : null}
        <div className="row"><button className="btn" type="submit" disabled={posting}>{posting ? (listingId ? 'Uploading…' : 'Publishing…') : 'Publish project'}</button></div>
        <p className="muted small">Contractors on Jobfile can then send you bids. You choose who to hire. Your project stays open for 30 days.</p>
      </div>
    </form>
  );
}
