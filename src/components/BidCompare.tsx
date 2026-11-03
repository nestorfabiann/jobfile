import Link from 'next/link';
import AcceptBid from '@/components/AcceptBid';
import { acceptBid } from '@/app/marketplace/actions';

export type CompareCol = {
  id: string; name: string; priceCents: number; price: string; range: 'low' | 'high' | 'in' | null;
  weeks: number | null; start: string; rating: { avg: number; count: number } | null;
  insurance: 'ok' | 'wait' | 'none'; until: string; inclusions: string; canAccept: boolean; messageHref: string;
};

const th: React.CSSProperties = { padding: 10, textAlign: 'left', verticalAlign: 'top', width: 150, minWidth: 150, maxWidth: 150, borderBottom: '1px solid var(--line)', fontSize: 13.5, lineHeight: 1.4 };
const lab: React.CSSProperties = { ...th, width: 86, minWidth: 86, maxWidth: 86, position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface)', color: 'var(--muted, #6b655e)', fontSize: 12, fontWeight: 700, borderRight: '1px solid var(--line)' };
const best = (on: boolean): React.CSSProperties => (on ? { background: 'var(--ok-soft, #d9f1e6)', color: 'var(--ok)', borderRadius: 8, padding: '2px 6px', fontWeight: 700, display: 'inline-block' } : {});
const tag = (t: string, tone: 'ok' | 'warn' | 'mut' = 'ok') => <span style={{ display: 'block', fontSize: 11.5, fontWeight: tone === 'mut' ? 500 : 700, color: tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--accent)' : 'var(--muted, #6b655e)', marginTop: 2 }}>{t}</span>;

/** One column per bid. Markers state facts about a row (lowest, fastest, highest rated). They are not a recommendation. */
export default function BidCompare({ cols, backHref }: { cols: CompareCol[]; backHref: string }) {
  const many = cols.length > 1;
  const lo = Math.min(...cols.map((c) => c.priceCents));
  const weeks = cols.filter((c) => c.weeks != null).map((c) => c.weeks as number);
  const fast = weeks.length ? Math.min(...weeks) : null;
  const rated = cols.filter((c) => c.rating);
  const top = rated.length ? Math.max(...rated.map((c) => (c.rating as { avg: number }).avg)) : null;
  const row = (label: string, cell: (c: CompareCol) => React.ReactNode) => (
    <tr><td style={lab}>{label}</td>{cols.map((c) => <td key={c.id} style={th}>{cell(c)}</td>)}</tr>
  );
  return (
    <section aria-label="Compare bids" className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Comparing {cols.length} bids</h2>
        <Link href={backHref} className="small" style={{ fontWeight: 700 }}>Close</Link>
      </div>
      {cols.length > 2 && <p className="muted small" style={{ margin: 0 }}>Swipe sideways to see all {cols.length} bids.</p>}
      <div style={{ position: 'relative' }}>
        <div className="card" style={{ padding: 0, overflowX: 'auto', gap: 0 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%' }}>
            <thead><tr><th style={lab} />{cols.map((c) => <th key={c.id} style={th}>{c.name}</th>)}</tr></thead>
            <tbody>
              {row('Price', (c) => (<><span style={{ ...best(many && c.priceCents === lo), fontSize: 18, fontWeight: 800 }}>{c.price}</span>{many && c.priceCents === lo ? tag('Lowest') : null}{c.range ? tag(c.range === 'low' ? 'Below local range' : c.range === 'high' ? 'Above local range' : 'Inside local range', c.range === 'in' ? 'mut' : 'warn') : null}</>))}
              {row('Time', (c) => (c.weeks == null && !c.start ? <span className="muted">Not given</span> : <>{c.weeks != null ? <span style={best(many && fast != null && c.weeks === fast)}>{c.weeks} week{c.weeks > 1 ? 's' : ''}</span> : null}{many && fast != null && c.weeks === fast ? tag('Fastest') : null}{c.start ? tag(`Starts ${c.start}`, 'mut') : null}</>))}
              {row('Rating', (c) => (c.rating ? <><span style={best(rated.length > 1 && c.rating.avg === top)}>★ {c.rating.avg.toFixed(1)}</span> <span className="muted small">({c.rating.count})</span>{rated.length > 1 && c.rating.avg === top ? tag('Highest rated') : null}</> : <span className="muted">No reviews yet</span>))}
              {row('Insurance', (c) => (c.insurance === 'ok' ? <span style={{ color: 'var(--ok)', fontWeight: 600 }}>Insured to {c.until}</span> : c.insurance === 'wait' ? 'Under review' : <span className="muted">None on file</span>))}
              {row('Included', (c) => c.inclusions || <span className="muted">Not listed</span>)}
              {row('', (c) => (
                <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {c.canAccept ? <AcceptBid action={acceptBid} bidId={c.id} name={c.name} price={c.price} /> : null}
                  <Link className="btn ghost" href={c.messageHref} style={{ minHeight: 40 }}>Message</Link>
                </div>
              ))}
            </tbody>
          </table>
        </div>
        {cols.length > 2 && <div aria-hidden="true" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 36, pointerEvents: 'none', borderRadius: '0 16px 16px 0', background: 'linear-gradient(90deg, transparent, var(--bg, #faf8f4))' }} />}
      </div>
    </section>
  );
}
