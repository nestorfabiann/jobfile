import { notFound } from 'next/navigation';
import { loadProject } from '@/lib/project';
import PendingButton from '@/components/PendingButton';
import PriceQuestions from '@/components/PriceQuestions';
import { DAILY_LIMIT, FINISHES, priceCheckEnabled, type CheckResult } from '@/lib/pricecheck';
import { dollars } from '@/lib/money';
import { runPriceCheck } from './actions';

// The price service can take a while. Give the request room on Vercel.
export const maxDuration = 60;

const TZ = 'America/Chicago';
const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

type Verdict = 'ok' | 'high' | 'low';
const verdict = (price: number, low: number, high: number): Verdict => (price < low ? 'low' : price > high ? 'high' : 'ok');
const LABEL: Record<Verdict, [string, string]> = {
  ok: ['In the typical range', 'ok'],
  high: ['Higher than typical', 'warn'],
  low: ['Lower than typical', 'warn'],
};

function Bar({ price, low, high }: { price: number; low: number; high: number }) {
  const min = Math.min(low * 0.6, price * 0.8);
  const max = Math.max(high * 1.25, price * 1.15);
  const span = max - min || 1;
  const pct = (v: number) => ((v - min) / span) * 100;
  return (
    <>
      <div className="track" role="img" aria-label={`Your price ${dollars(price)} against a typical range of ${dollars(low)} to ${dollars(high)}`}>
        <div className="band" style={{ left: `${pct(low)}%`, right: `${100 - pct(high)}%` }} />
        <div className="mark" style={{ left: `${pct(price)}%` }} data-t={dollars(price)} />
      </div>
      <div className="scale"><span>{dollars(low)}</span><span>typical range</span><span>{dollars(high)}</span></div>
    </>
  );
}

export default async function PriceCheck({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const { sb, project, role, contractorName } = await loadProject(params.id);
  if (role !== 'homeowner') notFound();

  if (!priceCheckEnabled()) {
    return (
      <div className="card">
        <h2>Price check</h2>
        <p className="muted">Price check is not turned on for this site yet.</p>
      </div>
    );
  }

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [{ data: latest }, { count }] = await Promise.all([
    sb.from('price_checks').select('area,finish,notes,created_at,result').eq('project_id', project.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('price_checks').select('id', { count: 'exact', head: true }).eq('project_id', project.id).gt('created_at', since),
  ]);
  const left = Math.max(0, DAILY_LIMIT - (count ?? 0));
  const result = (latest?.result ?? null) as CheckResult | null;

  let tot = 0;
  let flags = 0;
  if (result) {
    result.lines.forEach((l) => {
      tot += l.price_cents;
      if (verdict(l.price_cents, l.low_cents, l.high_cents) !== 'ok') flags++;
    });
  }
  const tv = result ? verdict(tot, result.total.low_cents, result.total.high_cents) : 'ok';

  return (
    <>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      <form action={runPriceCheck} className="card">
        <input type="hidden" name="project_id" value={project.id} />
        <div className="stack" style={{ gap: 4 }}>
          <h2>Is this price fair?</h2>
          <p className="muted small">
            Jobfile compares each priced line of your agreement with typical prices for the same work in your area. Only you see this page.
            {contractorName} is not told.
          </p>
        </div>
        <div className="grid2">
          <label className="fld">
            Area (city, state or ZIP)
            <input name="area" required maxLength={120} defaultValue={latest?.area ?? project.address ?? ''} placeholder="Plano, TX 75074" />
          </label>
          <label className="fld">
            Finish level
            <select name="finish" defaultValue={latest?.finish ?? 'standard'}>
              {Object.entries(FINISHES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="fld">
          Anything else it should know? (optional)
          <textarea name="notes" rows={2} maxLength={500} defaultValue={latest?.notes ?? ''} placeholder="Two-story house, 9 ft ceilings, oak cabinets with heavy grain" />
        </label>
        <div className="row">
          {left > 0 ? (
            <PendingButton className="btn accent" pendingText="Checking, this can take up to a minute…">{result ? 'Check prices again' : 'Check prices'}</PendingButton>
          ) : (
            <span className="box warn">You have used today&rsquo;s {DAILY_LIMIT} checks for this project.</span>
          )}
          <span className="muted small">
            {latest ? `Last checked ${stamp(latest.created_at as string)} · ` : ''}
            {left} of {DAILY_LIMIT} checks left today
          </span>
        </div>
      </form>

      {!result && (
        <div className="card"><p className="muted">No price check yet. It uses the priced lines in your agreement, so the agreement needs to be sent to you first.</p></div>
      )}

      {result && (
        <>
          <article className="card">
            <div className="verdict">
              <div className="stack" style={{ gap: 4 }}>
                <span className="lbl">Your agreed total</span>
                <span className="big">{dollars(tot)}</span>
              </div>
              <span className={`pill ${tv === 'ok' && !flags ? 'ok' : 'warn'}`}>{tv === 'ok' ? 'In range' : tv === 'high' ? 'Higher' : 'Lower'}</span>
            </div>
            <h2>
              {tv === 'ok'
                ? flags
                  ? `Within the typical range, with ${flags} line${flags === 1 ? '' : 's'} to ask about`
                  : 'Within the typical range'
                : tv === 'high'
                  ? 'Above the typical range for this scope'
                  : 'Below the typical range for this scope'}
            </h2>
            <Bar price={tot} low={result.total.low_cents} high={result.total.high_cents} />
            <div className="tiles">
              <div className="tile"><span className="lbl">Typical for this scope</span><b>{dollars(result.total.low_cents)}–{dollars(result.total.high_cents)}</b></div>
              <div className="tile"><span className="lbl">Confidence</span><b style={{ textTransform: 'capitalize' }}>{result.total.confidence}</b></div>
              <div className="tile"><span className="lbl">Lines to ask about</span><b>{flags} of {result.lines.length}</b></div>
            </div>
            <p className="muted small">
              {latest?.area}, {FINISHES[(latest?.finish as keyof typeof FINISHES) ?? 'standard'].toLowerCase()}. {result.notes}
            </p>
          </article>

          {result.lines.map((l) => {
            const v = verdict(l.price_cents, l.low_cents, l.high_cents);
            const [label, tone] = LABEL[v];
            return (
              <article className={`card line ${v === 'ok' ? 'ok' : 'warn'}`} key={l.id}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                    <span className="lbl">Scope line · {l.confidence} confidence</span>
                    <h3>{l.title}</h3>
                    {l.scope ? <span className="muted small">{l.scope}</span> : null}
                  </div>
                  <span className={`pill ${tone}`}>{label}</span>
                </div>
                <Bar price={l.price_cents} low={l.low_cents} high={l.high_cents} />
                {l.assumptions.length > 0 && (
                  <div>
                    <span className="lbl">Assumed</span>
                    <ul className="plain" style={{ marginTop: 6 }}>{l.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </div>
                )}
                {l.drivers.length > 0 && (
                  <div>
                    <span className="lbl">What moves this price</span>
                    <ul className="plain" style={{ marginTop: 6 }}>{l.drivers.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </div>
                )}
              </article>
            );
          })}

          <PriceQuestions
            projectId={project.id}
            contractorName={contractorName}
            items={result.lines
              .filter((l) => l.question)
              .map((l) => ({ id: l.id, title: l.title, question: l.question, flagged: verdict(l.price_cents, l.low_cents, l.high_cents) !== 'ok' }))}
          />
        </>
      )}

      <div className="card">
        <h3>What this is, and is not</h3>
        <ul className="plain">
          <li>An AI-written reference from general knowledge of typical costs. It can be out of date or wrong, and it has not seen your house.</li>
          <li>It is not a bid, an appraisal or professional advice. Use it to ask better questions, not to pressure anyone.</li>
          <li>A price below the typical range is not always good news. It can mean prep or materials are left out.</li>
          <li>Your agreement&rsquo;s line items and your notes are sent to Anthropic to produce the answer.</li>
        </ul>
      </div>
    </>
  );
}
