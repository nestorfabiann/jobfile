import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminInvites() {
  const { db } = await requireAdmin();
  const [{ count: opened }, { data: joins }, { data: codes }] = await Promise.all([
    db.from('invite_events').select('id', { count: 'exact', head: true }).eq('kind', 'open'),
    db.from('invite_events').select('code,invitee_id').eq('kind', 'join').limit(5000),
    db.from('invite_codes').select('user_id,code').limit(5000),
  ]);
  const js = (joins ?? []) as { code: string; invitee_id: string }[];
  const invitees = Array.from(new Set(js.map((j) => j.invitee_id).filter(Boolean)));
  let posted = 0;
  if (invitees.length) {
    const { data: ls } = await db.from('marketplace_listings').select('homeowner_id').in('homeowner_id', invitees).limit(5000);
    posted = new Set((ls ?? []).map((l: any) => l.homeowner_id as string)).size;
  }
  const owner = new Map<string, string>(((codes ?? []) as any[]).map((c) => [c.code as string, c.user_id as string] as [string, string]));
  const per = new Map<string, number>();
  js.forEach((j) => { const u = owner.get(j.code); if (u) per.set(u, (per.get(u) ?? 0) + 1); });
  const top = Array.from(per.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const ids = top.map(([u]) => u);
  const ps: any[] = ids.length ? ((await db.from('profiles').select('id,full_name,email').in('id', ids)).data as any[]) ?? [] : [];
  const nm = new Map<string, string>(ps.map((p) => [p.id as string, (p.full_name || p.email || 'Someone') as string] as [string, string]));
  return (
    <>
      <h1>Invites</h1>
      <div className="tiles">
        <div className="tile"><span className="small muted">Opened</span><b>{opened ?? 0}</b></div>
        <div className="tile"><span className="small muted">Joined</span><b>{js.length}</b></div>
        <div className="tile"><span className="small muted">Posted a job</span><b>{posted}</b></div>
      </div>
      <div className="card">
        <h2>Top inviters</h2>
        {top.length === 0 ? <p className="muted">No one has joined through an invite yet.</p> : top.map(([u, n]) => (
          <div key={u} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><span>{nm.get(u) ?? 'Someone'}</span><b>{n} joined</b></div>
        ))}
      </div>
      <p className="muted small" style={{ margin: 0 }}>Each new person&apos;s profile also says who invited them.</p>
    </>
  );
}
