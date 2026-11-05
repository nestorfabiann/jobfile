import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PSTATUS, type ProjectPartner } from '@/lib/partners';
import { removePartner } from '@/app/partner/actions';

const COLORS = ['#c4813f', '#2f5f8a', '#7a4a6b', '#1d6f73', '#a2503a', '#6b7a2a', '#4a5568'];
const colorFor = (s: string) => COLORS[Array.from(s).reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];
const initial = (s: string) => (s.trim()[0] ?? '?').toUpperCase();
const circle: React.CSSProperties = { width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 18, position: 'relative', flex: 'none' };

/** Partners brought in by the lead. The lead manages them; the homeowner sees who is on the job and can remove one. Renders nothing when there are none and the viewer is the homeowner. */
export default async function ProjectPartners({ projectId, role, notice, variant = 'bottom' }: { projectId: string; role: 'contractor' | 'homeowner'; notice?: string; variant?: 'top' | 'bottom' }) {
  const db = supabaseAdmin();
  let rows: ProjectPartner[] = [];
  try {
    const { data } = await db.from('project_partners').select('*').eq('project_id', projectId).in('status', ['invited', 'countered', 'accepted']).order('created_at');
    rows = (data ?? []) as ProjectPartner[];
  } catch { /* table not created yet */ }
  if (role === 'homeowner') rows = rows.filter((r) => r.status === 'accepted');
  if (role === 'homeowner' && rows.length === 0) return null;

  const ids = rows.map((r) => r.partner_company_id).filter(Boolean) as string[];
  const info = new Map<string, { name: string; verified: boolean; insured: boolean }>();
  if (ids.length) {
    const { data } = await db.from('companies').select('id,name,verified_at,hidden_at').in('id', ids);
    const { data: ins } = await db.from('company_insurance').select('company_id,expires_on').in('company_id', ids).eq('status', 'approved').gt('expires_on', new Date().toISOString().slice(0, 10));
    const insured = new Set(((ins ?? []) as any[]).map((i) => i.company_id as string));
    ((data ?? []) as any[]).forEach((c) => info.set(c.id, { name: c.name, verified: !!c.verified_at && !c.hidden_at, insured: insured.has(c.id) }));
  }
  let leadName = 'You';
  if (role === 'contractor') {
    const { data: pr } = await db.from('projects').select('company_id').eq('id', projectId).maybeSingle<any>();
    if (pr?.company_id) {
      const { data: co } = await db.from('companies').select('name').eq('id', pr.company_id).maybeSingle<any>();
      if (co?.name) leadName = co.name as string;
    }
  }
  const nameOf = (r: ProjectPartner) => (r.partner_company_id ? info.get(r.partner_company_id)?.name : undefined) ?? r.partner_name;
  const dotColor = (r: ProjectPartner) => (r.status === 'accepted' ? '#2f9e60' : '#e0a030');
  const Dot = ({ r }: { r: ProjectPartner }) => <i aria-hidden="true" style={{ position: 'absolute', right: -1, bottom: -1, width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--surface, #fff)', background: dotColor(r) }} />;

  // Top of the page: only a slim team strip, and only when there are partners. Everything else sits lower down.
  if (variant === 'top') {
    if (rows.length === 0) return null;
    const allIn = rows.every((r) => r.status === 'accepted');
    const strip = (
      <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'nowrap', alignItems: 'center' }}>
        <span className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'center', minWidth: 0 }}>
          <span style={{ display: 'flex' }} aria-hidden="true">
            {role === 'contractor' ? <span style={{ ...circle, width: 32, height: 32, fontSize: 14, background: '#1f4d3a', border: '2px solid var(--surface, #fff)' }}>{initial(leadName)}</span> : null}
            {rows.slice(0, 4).map((r, i) => <span key={r.id} style={{ ...circle, width: 32, height: 32, fontSize: 14, background: colorFor(nameOf(r)), border: '2px solid var(--surface, #fff)', marginLeft: role === 'contractor' || i > 0 ? -8 : 0 }}>{initial(nameOf(r))}</span>)}
          </span>
          <b style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rows.length === 1 ? `Team: ${role === 'contractor' ? 'you + ' : ''}${nameOf(rows[0])}` : `Team · ${rows.length} partners`}</b>
        </span>
        <span className={`pill${allIn ? ' ok' : ' warn'}`}>{allIn ? 'Confirmed' : 'Waiting'}</span>
      </div>
    );
    return (
      <section className="card" aria-label="Team" style={{ padding: '12px 14px', gap: 8 }}>
        {notice ? <div className="box ok" role="status">{notice}</div> : null}
        {role === 'contractor' ? <Link href={`/projects/${projectId}/partners`} style={{ color: 'inherit', textDecoration: 'none' }}>{strip}</Link> : strip}
      </section>
    );
  }

  // Nothing yet: a picture of you plus a partner, and what a partner can and cannot see.
  if (role === 'contractor' && rows.length === 0) {
    return (
      <Link href={`/projects/${projectId}/partners/new`} className="card" aria-label="Bring in a partner" style={{ color: 'inherit', textDecoration: 'none', flexDirection: 'row', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1.5px dashed var(--orb, #d9c9a8)' }}>
        <span aria-hidden="true" style={{ ...circle, width: 38, height: 38, background: 'transparent', border: '2px dashed #c4813f', color: '#c4813f', fontSize: 22 }}>+</span>
        <span style={{ minWidth: 0 }}>
          <b style={{ display: 'block' }}>Bring in a partner</b>
          <span className="muted small">Share part of the job with another pro. They only see their part.</span>
        </span>
        <span className="btn accent" style={{ marginLeft: 'auto', padding: '8px 16px', minHeight: 0, whiteSpace: 'nowrap' }}>Add</span>
      </Link>
    );
  }

  return (
    <section className="card" aria-label="Team" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Team · {rows.length} partner{rows.length === 1 ? '' : 's'}</h2>
        {role === 'contractor' ? <Link href={`/projects/${projectId}/partners/new`} style={{ fontWeight: 700 }}>+ Add</Link> : null}
      </div>
      {notice ? <div className="box ok" role="status">{notice}</div> : null}
      {role === 'homeowner' ? <p className="muted small">Your contractor brought these companies in for part of the job. Your contractor stays your contact. You can remove a partner.</p> : null}
      {role === 'contractor' ? (
        <div className="row" style={{ gap: 8, alignItems: 'center' }} aria-hidden="true">
          <span style={{ ...circle, background: '#1f4d3a' }}>{initial(leadName)}</span>
          {rows.map((r) => <span key={r.id} style={{ ...circle, background: colorFor(nameOf(r)) }}>{initial(nameOf(r))}<Dot r={r} /></span>)}
          <Link href={`/projects/${projectId}/partners/new`} style={{ ...circle, width: 40, height: 40, background: 'transparent', border: '2px dashed #c4813f', color: '#c4813f', fontSize: 22 }}>+</Link>
        </div>
      ) : null}
      {rows.map((r) => {
        const c = r.partner_company_id ? info.get(r.partner_company_id) : undefined;
        const name = nameOf(r);
        return (
          <div key={r.id} className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'nowrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <span className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start', minWidth: 0 }}>
              <span aria-hidden="true" style={{ ...circle, width: 36, height: 36, fontSize: 15, background: colorFor(name) }}>{initial(name)}</span>
              <span style={{ minWidth: 0 }}>
                <b>{r.partner_company_id && role === 'homeowner' ? <Link href={`/contractors/${r.partner_company_id}`}>{name}</Link> : name}</b>
                <span className="muted small" style={{ display: 'block', overflowWrap: 'anywhere' }}>{r.scope}</span>
                <span className="small" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {c?.verified ? <span className="pill ok">Verified</span> : <span className="pill">Not verified yet</span>}
                  {c?.insured ? <span className="pill ok">Insured</span> : null}
                  {role === 'contractor' ? <span className={`pill${r.status === 'accepted' ? ' ok' : ' warn'}`}>{PSTATUS[r.status]}</span> : null}
                </span>
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
    </section>
  );
}
