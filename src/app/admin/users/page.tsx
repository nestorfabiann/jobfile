import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function Users({ searchParams }: { searchParams: { q?: string } }) {
  const { db } = await requireAdmin();
  // Strip characters that have meaning inside a PostgREST filter.
  const q = (searchParams.q ?? '').replace(/[^a-zA-Z0-9@._+\- ]/g, '').trim();
  let query = db.from('profiles').select('id,email,full_name,created_at,banned_at').order('created_at', { ascending: false }).limit(100);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  const { data } = await query;
  return (
    <>
      <h1>Users</h1>
      <form className="row" method="get">
        <input name="q" defaultValue={q} placeholder="Search name or email" />
        <button className="btn ghost">Search</button>
      </form>
      <div className="card" style={{ gap: 0, padding: 0 }}>
        {(data ?? []).map((u, i) => (
          <Link key={u.id} href={`/admin/users/${u.id}`} className="row" style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--line)' : 'none', justifyContent: 'space-between', color: 'inherit', textDecoration: 'none' }}>
            <span>
              {u.email} {u.full_name && <span className="muted">· {u.full_name}</span>}
            </span>
            <span className="row">
              {u.banned_at && <span className="pill bad">suspended</span>}
              <span className="small muted">{new Date(u.created_at).toLocaleDateString('en-US')}</span>
            </span>
          </Link>
        ))}
        {!data?.length && <p className="muted" style={{ padding: 16 }}>No matches.</p>}
      </div>
    </>
  );
}
