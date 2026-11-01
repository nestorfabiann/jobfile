import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function Projects({ searchParams }: { searchParams: { q?: string } }) {
  const { db } = await requireAdmin();
  const q = (searchParams.q ?? '').replace(/[^a-zA-Z0-9@._+\- ]/g, '').trim();
  let query = db
    .from('projects')
    .select('id,name,address,homeowner_email,created_at,companies(name)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (q) query = query.or(`name.ilike.%${q}%,homeowner_email.ilike.%${q}%,address.ilike.%${q}%`);
  const { data } = await query;
  return (
    <>
      <h1>Projects</h1>
      <form className="row" method="get">
        <input name="q" defaultValue={q} placeholder="Search project, address or homeowner email" />
        <button className="btn ghost">Search</button>
      </form>
      <div className="card" style={{ gap: 0, padding: 0 }}>
        {(data ?? []).map((p: any, i) => (
          <Link key={p.id} href={`/admin/projects/${p.id}`} className="row" style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--line)' : 'none', justifyContent: 'space-between', color: 'inherit', textDecoration: 'none' }}>
            <span>
              {p.name} <span className="muted small">· {p.companies?.name ?? ''} → {p.homeowner_email}</span>
            </span>
            <span className="small muted">{new Date(p.created_at).toLocaleDateString('en-US')}</span>
          </Link>
        ))}
        {!data?.length && <p className="muted" style={{ padding: 16 }}>No matches.</p>}
      </div>
    </>
  );
}
