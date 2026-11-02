import TradeIcon from '@/components/TradeIcon';
import Link from 'next/link';
import { dollars } from '@/lib/money';
import { listingTitle } from '@/lib/marketplace';
import type { PublicListing } from '@/lib/publicMarketplace';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

export default function PublicJobCard({ l, bids }: { l: PublicListing; bids: number }) {
  const hasAI = l.ai_low_cents != null && l.ai_high_cents != null;
  return (
    <Link href={`/jobs/${l.id}`} className="card" style={{ color: 'inherit', textDecoration: 'none' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="pill"><TradeIcon trade={l.job_type} size={15} />{l.job_type}</span>
        <span className="pill ok">Open</span>
      </div>
      <h3 style={{ margin: 0 }}>{listingTitle(l)}</h3>
      <p className="muted small" style={{ margin: 0 }}>
        {[l.city, `ZIP ${l.zip}`, l.size_sqft ? `${l.size_sqft.toLocaleString('en-US')} sq ft` : ''].filter(Boolean).join(' · ')}
      </p>
      <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
        <b style={{ color: 'var(--accent)', fontSize: 18 }}>{hasAI ? `${dollars(l.ai_low_cents as number)} – ${dollars(l.ai_high_cents as number)}` : 'Price range pending'}</b>
        <span className="muted small">{hasAI ? 'AI reference · ' : ''}{bids} bid{bids === 1 ? '' : 's'} · {when(l.created_at)}</span>
      </div>
    </Link>
  );
}
