import Link from 'next/link';

export type Alert = { id: string; title: string; created_at: string; read_at?: string | null; kind?: string | null };

const shortWhen = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  if (mins < 48 * 60) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
};

function Icon({ title }: { title: string }) {
  const t = title.toLowerCase();
  const path = /repl/.test(t)
    ? <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    : /finish|complete|approved|paid|accepted|confirmed/.test(t)
      ? <path d="m5 12.5 4.5 4.5L19 7.5" />
      : <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>;
  return (
    <span aria-hidden="true" className="ra-ic">
      <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
    </span>
  );
}

function Row({ a }: { a: Alert }) {
  const unread = !a.read_at;
  return (
    <li>
      <Link href={`/n/${a.id}`} prefetch={false} className="ra-row">
        <span className={unread ? 'ra-dot' : 'ra-dot off'} aria-label={unread ? 'New' : undefined} />
        <Icon title={a.title} />
        <span className="ra-tx" title={a.title}>{a.title}</span>
        <span className="ra-tm">{shortWhen(a.created_at)}</span>
      </Link>
    </li>
  );
}

/** Three most recent alerts as compact rows; any others are one tap away. */
export default function RecentActivity({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const first = alerts.slice(0, 3);
  const rest = alerts.slice(3);
  return (
    <section className="card" aria-label="Recent activity" style={{ gap: 4 }}>
      <h2 style={{ marginBottom: 2 }}>Recent activity</h2>
      <ul className="ra-list">{first.map((a) => <Row key={a.id} a={a} />)}</ul>
      {rest.length > 0 ? (
        <details className="ra-more">
          <summary>Show {rest.length} more</summary>
          <ul className="ra-list">{rest.map((a) => <Row key={a.id} a={a} />)}</ul>
        </details>
      ) : null}
    </section>
  );
}
