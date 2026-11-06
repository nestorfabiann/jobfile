import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import TipForm from '@/components/TipForm';

export const dynamic = 'force-dynamic';

export default async function ShareTip({ searchParams }: { searchParams: { error?: string } }) {
  requireMarketplace();
  await requireUser();
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link href="/community?k=tip" className="small">‹ Community</Link>
      <h1>Share a tip</h1>
      <p className="muted">Something you learned the hard way? A short tip can save a neighbor time and money.</p>
      {searchParams.error ? <div className="box bad" role="alert">{searchParams.error}</div> : null}
      <TipForm trades={Object.keys(JOB_TYPES)} />
    </div>
  );
}
