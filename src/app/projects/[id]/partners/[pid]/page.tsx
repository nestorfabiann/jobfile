import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { PSTATUS, type ProjectPartner } from '@/lib/partners';
import { acceptPartnerPrice, recordPartnerPayout, removePartner } from '@/app/partner/actions';
import PartnerThread, { type PMsg } from '@/components/PartnerThread';

export const dynamic = 'force-dynamic';

export default async function LeadPartner({ params, searchParams }: { params: { id: string; pid: string }; searchParams: { error?: string; ok?: string } }) {
  const { project, role } = await loadProject(params.id);
  if (role !== 'contractor') redirect(`/projects/${project.id}/overview`);
  const db = supabaseAdmin();
  const { data: p } = await db.from('project_partners').select('*').eq('id', params.pid).eq('project_id', project.id).maybeSingle<ProjectPartner>();
  if (!p) redirect(`/projects/${project.id}/overview`);
  const { data: ms } = await db.from('partner_messages').select('id,sender_side,body,created_at').eq('partner_id', p.id).order('created_at').limit(200);
  let name = p.partner_name;
  let verified = false;
  if (p.partner_company_id) {
    const { data: co } = await db.from('companies').select('name,verified_at,hidden_at').eq('id', p.partner_company_id).maybeSingle<any>();
    if (co?.name) name = co.name;
    verified = !!co?.verified_at && !co?.hidden_at;
  }
  const live = ['invited', 'countered', 'accepted'].includes(p.status);
  const left = p.price_cents - p.paid_cents;
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 90 }}>
      <Link href={`/projects/${project.id}/overview`} className="small" style={{ fontWeight: 700 }}>‹ {project.name}</Link>
      <div className="row" style={{ justifyContent: 'space-between' }}><h1>{name}</h1><span className={`pill${p.status === 'accepted' ? ' ok' : ''}`}>{PSTATUS[p.status]}</span></div>
      {searchParams.error ? <div className="box warn" role="alert">{searchParams.error}</div> : null}
      {searchParams.ok ? <div className="box ok" role="status">{searchParams.ok}</div> : null}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="muted small">Their part</span>
        <b>{p.scope}</b>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small">Price</span><b>{dollars(p.price_cents)}</b></div>
        {p.start_date || p.end_date ? <span className="muted small">{p.start_date ?? '…'} to {p.end_date ?? '…'}</span> : null}
        <span className="muted small">{p.partner_email}{!verified ? ' · Not verified yet' : ''}</span>
        {p.status === 'countered' && p.counter_cents ? (
          <form action={acceptPartnerPrice} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input type="hidden" name="id" value={p.id} />
            <span className="pill warn" style={{ width: 'max-content' }}>They proposed {dollars(p.counter_cents)}</span>
            <button className="btn" type="submit">Accept {dollars(p.counter_cents)}</button>
          </form>
        ) : null}
      </div>
      {p.status === 'accepted' ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2>Payout</h2>
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small">Paid to them</span><b>{dollars(p.paid_cents)} of {dollars(p.price_cents)}</b></div>
          {left > 0 ? (
            <form action={recordPartnerPayout} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <input type="hidden" name="id" value={p.id} />
              <input name="amount" inputMode="decimal" placeholder="Amount paid" aria-label="Amount paid" style={{ flex: 1 }} required />
              <button className="btn" type="submit">Record</button>
            </form>
          ) : <span className="pill ok" style={{ width: 'max-content' }}>Paid in full</span>}
          <p className="muted small">Jobfile only keeps the record. It does not move money.</p>
        </div>
      ) : null}
      <PartnerThread id={p.id} msgs={(ms ?? []) as PMsg[]} me="lead" other={name} />
      {live ? (
        <form action={removePartner}><input type="hidden" name="id" value={p.id} /><button className="btn ghost" type="submit">{p.status === 'accepted' ? 'Remove this partner' : 'Cancel this invite'}</button></form>
      ) : null}
    </div>
  );
}
