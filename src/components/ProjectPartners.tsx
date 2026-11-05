import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PSTATUS, type ProjectPartner } from '@/lib/partners';
import { removePartner } from '@/app/partner/actions';

/** Partners brought in by the lead. The lead manages them; the homeowner sees who is on the job and can remove one. Renders nothing when there are none and the viewer is the homeowner. */
export default async function ProjectPartners({ projectId, role, notice }: { projectId: string; role: 'contractor' | 'homeowner'; notice?: string }) {
  let rows: ProjectPartner[] = [];
  try {
    const { data } = await supabaseAdmin().from('project_partners').select('*').eq('project_id', projectId).in('status', ['invited', 'countered', 'accepted']).order('created_at');
    rows = (data ?? []) as ProjectPartner[];
  } catch { /* table not created yet */ }
  if (role === 'homeowner') rows = rows.filter((r) => r.status === 'accepted');
  if (role === 'homeowner' && rows.length === 0) return null;

  const ids = rows.map((r) => r.partner_company_id).filter(Boolean) as string[];
  const info = new Map<string, { name: string; verified: boolean; insured: boolean }>();
  if (ids.length) {
    const { data } = await supabaseAdmin().from('companies').select('id,name,verified_at,hidden_at').in('id', ids);
    const { data: ins } = await supabaseAdmin().from('company_insurance').select('company_id,expires_on').in('company_id', ids).eq('status', 'approved').gt('expires_on', new Date().toISOString().slice(0, 10));
    const insured = new Set(((ins ?? []) as any[]).map((i) => i.company_id as string));
    ((data ?? []) as any[]).forEach((c) => info.set(c.id, { name: c.name, verified: !!c.verified_at && !c.hidden_at, insured: insured.has(c.id) }));
  }

  return (
    <section className="card" aria-label="Team" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2>Team</h2>
      {notice ? <div className="box ok" role="status">{notice}</div> : null}
      {role === 'homeowner' ? <p className="muted small">Your contractor brought these companies in for part of the job. Your contractor stays your contact. You can remove a partner.</p> : null}
      {rows.length === 0 ? <p className="muted small">Just your company so far. Bring in a contractor you work with. They only see their part.</p> : null}
      {rows.map((r) => {
        const c = r.partner_company_id ? info.get(r.partner_company_id) : undefined;
        const name = c?.name ?? r.partner_name;
        return (
          <div key={r.id} className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ minWidth: 0 }}>
              <b>{r.partner_company_id && role === 'homeowner' ? <Link href={`/contractors/${r.partner_company_id}`}>{name}</Link> : name}</b>
              <span className="muted small" style={{ display: 'block', overflowWrap: 'anywhere' }}>{r.scope}</span>
              <span className="small" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                {c?.verified ? <span className="pill ok">Verified</span> : <span className="pill">Not verified yet</span>}
                {c?.insured ? <span className="pill ok">Insured</span> : null}
                {role === 'contractor' ? <span className="pill">{PSTATUS[r.status]}</span> : null}
              </span>
            </span>
            {role === 'contractor' ? (
              <Link href={`/projects/${projectId}/partners/${r.id}`} style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Open ›</Link>
            ) : (
              <form action={removePartner}><input type="hidden" name="id" value={r.id} /><button className="btn ghost" type="submit">Remove</button></form>
            )}
          </div>
        );
      })}
      {role === 'contractor' ? <Link className="btn ghost" href={`/projects/${projectId}/partners/new`}>+ Add a partner</Link> : null}
    </section>
  );
}
