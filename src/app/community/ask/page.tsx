import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import AskForm from '@/components/AskForm';

export const dynamic = 'force-dynamic';

export default async function Ask({ searchParams }: { searchParams: { error?: string } }) {
  requireMarketplace();
  await requireUser();
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link href="/community?k=idea" className="small">‹ Community</Link>
      <h1>Ask for ideas</h1>
      <p className="muted">Stuck on a color, a layout or a material? Ask the community. Add a poll to get quick votes.</p>
      {searchParams.error ? <div className="box bad" role="alert">{searchParams.error}</div> : null}
      <AskForm trades={Object.keys(JOB_TYPES)} />
    </div>
  );
}
