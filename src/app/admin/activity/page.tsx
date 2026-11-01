import { requireAdmin } from '@/lib/admin';
import { KINDS, loadFeed, lookups } from '@/lib/adminFeed';
import AdminFeed from '@/components/AdminFeed';

export const dynamic = 'force-dynamic';

export default async function Activity({ searchParams }: { searchParams: { kind?: string; n?: string } }) {
  await requireAdmin();
  const kind = KINDS.find((k) => k === searchParams.kind);
  const limit = Math.min(Math.max(parseInt(searchParams.n ?? '100', 10) || 100, 20), 500);
  const events = await loadFeed({ kinds: kind ? [kind] : undefined, limit });
  const names = await lookups(events);
  return (
    <>
      <h1>Activity</h1>
      <p className="muted small">What happened, not what was said. Message text is only visible through a project&apos;s “View conversation”, which is logged.</p>
      <form className="row" method="get">
        <select name="kind" defaultValue={kind ?? ''}>
          <option value="">All types</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <select name="n" defaultValue={String(limit)}>
          {[50, 100, 250, 500].map((n) => (
            <option key={n} value={n}>{n} rows</option>
          ))}
        </select>
        <button className="btn ghost">Filter</button>
      </form>
      <AdminFeed events={events} names={names} />
    </>
  );
}
