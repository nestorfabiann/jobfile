import Link from 'next/link';
import type { FeedEvent } from '@/lib/adminFeed';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function AdminFeed({
  events,
  names,
}: {
  events: FeedEvent[];
  names: { project: Record<string, string>; user: Record<string, string> };
}) {
  if (!events.length) return <p className="muted">Nothing yet.</p>;
  return (
    <div className="card" style={{ gap: 0, padding: 0 }}>
      {events.map((e, i) => (
        <div key={i} className="row" style={{ padding: '10px 16px', borderTop: i ? '1px solid var(--line)' : 'none', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div>
              <span className="pill" style={{ marginRight: 8 }}>{e.kind}</span>
              {e.text}
            </div>
            <div className="small muted">
              {e.projectId && (
                <Link href={`/admin/projects/${e.projectId}`}>{names.project[e.projectId] ?? 'Project'}</Link>
              )}
              {e.projectId && e.userId && ' · '}
              {e.userId && <Link href={`/admin/users/${e.userId}`}>{names.user[e.userId] ?? 'User'}</Link>}
            </div>
          </div>
          <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{when(e.at)}</span>
        </div>
      ))}
    </div>
  );
}
