import Link from 'next/link';
import AcceptBid from '@/components/AcceptBid';
import { acceptBid } from '@/app/marketplace/actions';
import { barPos } from '@/lib/barPos';
import { dollars } from '@/lib/money';

export type CompareCol = {
  id: string; name: string; priceCents: number; price: string; range: 'low' | 'high' | 'in' | null;
  weeks: number | null; start: string; rating: { avg: number; count: number } | null;
  insurance: 'ok' | 'wait' | 'none'; until: string; inclusions: string; canAccept: boolean; messageHref: string;
  logo?: string; verified?: boolean; profileHref?: string;
};

const th: React.CSSProperties = { padding: 10, textAlign: 'left', verticalAlign: 'top', width: 150, minWidth: 150, maxWidth: 150, borderBottom: '1px solid var(--line)', fontSize: 13.5, lineHeight: 1.4 };
const lab: React.CSSProperties = { ...th, width: 86, minWidth: 86, maxWidth: 86, position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface)', color: 'var(--muted, #6b655e)', fontSize: 12, fontWeight: 700, borderRight: '1px solid var(--line)' };
const best = (on: boolean): React.CSSProperties => (on ? { background: 'var(--ok-soft, #d9f1e6)', color: 'var(--ok)', borderRadius: 8, padding: '2px 6px', fontWeight: 700, display: 'inline-block' } : {});
const tag = (t: string, tone: 'ok' | 'warn' | 'mut' = 'ok') => <span style={{ display: 'block', fontSize: 11.5, fontWeight: tone === 'mut' ? 500 : 700, color: tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--accent)' : 'var(--muted, #6b655e)', marginTop: 2 }}>{t}</span>;

/** One column per bid. Markers state facts about a row (lowest, fastest, highest rated). They are not a recommendation. */
export default function BidCompare({ cols, backHref, aiRange }: { cols: CompareCol[]; backHref: string; aiRange?: { lo: number; hi: number; likely: number | null } | null }) {
  const many = cols.length > 1;
  const lo = Math.min(...cols.map((c) => c.priceCents));
  const weeks = cols.filter((c) => c.weeks != null).map((c) => c.weeks as number);
  const fast = weeks.length ? Math.min(...weeks) : null;
  const rated = cols.filter((c) => c.rating);
  const top = rated.length ? Math.max(...rated.map((c) => (c.rating as { avg: number }).avg)) : null;
  const pill = (t: string, tone: 'ok' | 'warn' | 'mut') => (
    <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap', background: tone === 'ok' ? 'var(--ok-soft, #d9f1e6)' : tone === 'warn' ? 'var(--warn-bg, #fbeccd)' : 'transparent', color: tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn, #9a5b00)' : 'var(--muted, #6b655e)', border: tone === 'mut' ? '1px solid var(--line)' : '1px solid transparent' }}>{t}</span>
  );
  const row = (label: string, cell: (c: CompareCol) => React.ReactNode) => (
    <tr><td style={lab}>{label}</td>{cols.map((c) => <td key={c.id} style={th}>{cell(c)}</td>)}</tr>
  );
  return (
    <section aria-label="Compare bids" className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Comparing {cols.length} bids</h2>
        <Link href={backHref} className="small" style={{ fontWeight: 700 }}>Close</Link>
      </div>
      {aiRange && (
        <div className="card" style={{ gap: 6 }}>
          <h3 style={{ fontSize: 15, margin: 0 }}>Typical price for this job</h3>
          <div role="img" aria-label="Where each bid falls in the typical price range" style={{ position: 'relative', height: 10, borderRadius: 8, background: 'var(--line)', margin: '10px 0 4px' }}>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: '18%', width: '60%', borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 45%, transparent)' }} />
            {cols.map((c) => <div key={c.id} style={{ position: 'absolute', top: -5, width: 4, height: 20, borderRadius: 2, background: many && c.priceCents === lo ? 'var(--ok)' : 'var(--ink)', left: `${barPos(c.priceCents, aiRange.lo, aiRange.hi)}%` }} />)}
          </div>
          <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{dollars(aiRange.lo)}</span>{aiRange.likely != null && <span>Likely {dollars(aiRange.likely)}</span>}<span>{dollars(aiRange.hi)}</span></div>
          <p className="muted small" style={{ margin: 0 }}>The marks are the bids below, on the same scale.</p>
        </div>
      )}
      {cols.length > 2 && <p className="muted small" style={{ margin: 0 }}>Swipe sideways to see all {cols.length} bids.</p>}
      <div style={{ position: 'relative' }}>
        <div className="card" style={{ padding: 0, overflowX: 'auto', gap: 0 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%' }}>
            <thead><tr><th style={lab} />{cols.map((c) => (
              <th key={c.id} style={th}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {c.logo ? <img src={c.logo} alt="" width={34} height={34} style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover', flex: 'none' }} /> : <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--accent-soft, #f9efe4)', color: 'var(--accent)', fontWeight: 800 }}>{c.name.slice(0, 1).toUpperCase()}</span>}
                  {c.profileHref ? <Link href={c.profileHref} style={{ fontWeight: 700, lineHeight: 1.2 }}>{c.name}</Link> : <b>{c.name}</b>}
                </div>
                <div style={{ marginTop: 6 }}>{c.verified ? pill('✓ Verified', 'ok') : pill('Not verified', 'mut')}</div>
              </th>
            ))}</tr></thead>
            <tbody>
              {row('Price', (c) => (<><span style={{ ...best(many && c.priceCents === lo), fontSize: 18, fontWeight: 800 }}>{c.price}</span>{many && c.priceCents === lo ? <div style={{ marginTop: 5 }}>{pill('Lowest', 'ok')}</div> : null}{c.range ? tag(c.range === 'low' ? 'Below local range' : c.range === 'high' ? 'Above local range' : 'Inside local range', c.range === 'in' ? 'mut' : 'warn') : null}</>))}
              {row('Time', (c) => (c.weeks == null && !c.start ? <span className="muted">Not given</span> : <>{c.weeks != null ? <span style={best(many && fast != null && c.weeks === fast)}>{c.weeks} week{c.weeks > 1 ? 's' : ''}</span> : null}{many && fast != null && c.weeks === fast ? tag('Fastest') : null}{c.start ? tag(`Starts ${c.start}`, 'mut') : null}</>))}
              {row('Rating', (c) => (c.rating ? <><span style={best(rated.length > 1 && c.rating.avg === top)}>★ {c.rating.avg.toFixed(1)}</span> <span className="muted small">({c.rating.count})</span>{rated.length > 1 && c.rating.avg === top ? tag('Highest rated') : null}</> : <span className="muted">No reviews yet</span>))}
              {row('Insurance', (c) => (c.insurance === 'ok' ? <>{pill('Insured', 'ok')}{c.until ? tag(`to ${c.until}`, 'mut') : null}</> : c.insurance === 'wait' ? pill('Under review', 'mut') : pill('None on file', 'warn')))}
              {row('Included', (c) => c.inclusions || <span className="muted">Not listed</span>)}
              {row('', (c) => (c.canAccept ? <AcceptBid action={acceptBid} bidId={c.id} name={c.name} price={c.price} /> : <span className="muted small">Not open</span>))}
              {row('', (c) => <Link className="btn ghost" href={c.messageHref} style={{ minHeight: 40 }}>Message</Link>)}
            </tbody>
          </table>
        </div>
        {cols.length > 2 && <div aria-hidden="true" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 36, pointerEvents: 'none', borderRadius: '0 16px 16px 0', background: 'linear-gradient(90deg, transparent, var(--bg, #faf8f4))' }} />}
      </div>
    </section>
  );
}
