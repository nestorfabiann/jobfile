import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import { companyReviews, summarize } from '@/lib/reviews';
import { idVerifiedMap } from '@/lib/idCheck';
import { signedUrls } from '@/lib/companyProfile';
import { profileMeter } from '@/lib/profileMeter';

/** Mini version of the public profile for the contractor's Settings page, built from what is saved. */
export default async function ProfilePreview({ companyId }: { companyId: string }) {
  const db = supabaseAdmin();
  const { data: c } = await db.from('companies').select('name,about,services,service_radius_mi,logo_path,business_zip').eq('id', companyId).maybeSingle<any>();
  if (!c) return null;
  const { data: photos } = await db.from('company_photos').select('path').eq('company_id', companyId).order('created_at').limit(24);
  const all = (photos ?? []).map((p: any) => p.path as string);
  const urls = await signedUrls('company-photos', [...all.slice(0, 3), ...(c.logo_path ? [c.logo_path as string] : [])]);
  let nCreds = 0;
  try { nCreds = (await db.from('company_credentials').select('id', { count: 'exact', head: true }).eq('company_id', companyId).neq('status', 'rejected')).count ?? 0; } catch { /* table not created yet */ }
  const idOk = (await idVerifiedMap([companyId])).has(companyId);
  const s = summarize(await companyReviews(companyId));
  const services: string[] = Array.isArray(c.services) ? c.services : [];
  const meter = await profileMeter(companyId);
  const items = meter.items;
  const pct = meter.pct;
  const left = items.filter((i) => !i.ok).length;
  const extras: { ok: boolean; label: string; href: string }[] = [
    { ok: idOk, label: 'ID verified', href: '/settings/business#bp-id' },
    { ok: nCreds > 0, label: 'Credentials (BBB, chamber)', href: '/settings/business#bp-cred' },
  ];
  const logo = c.logo_path ? urls.get(c.logo_path) : null;
  const area = [c.business_zip, c.service_radius_mi ? `${c.service_radius_mi} mi` : ''].filter(Boolean).join(' · ');
  const meta = [s.count > 0 ? `★ ${s.avg.toFixed(1)} · ${s.count} review${s.count > 1 ? 's' : ''}` : 'No reviews yet', area].filter(Boolean).join(' · ');
  return (
    <div className="ppv">
      <div className="ppv-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img src={logo} alt="" width={44} height={44} className="ppv-lg" /> : <span className="ppv-lg em" aria-hidden="true">{(c.name ?? '?').slice(0, 1).toUpperCase()}</span>}
        <div style={{ minWidth: 0 }}><b>{c.name}</b><span>{meta}</span></div>
      </div>
      <div className="ppv-ph">
        {[0, 1, 2].map((i) => {
          const u = all[i] ? urls.get(all[i]) : null;
          // eslint-disable-next-line @next/next/no-img-element
          return u ? <img key={i} src={u} alt="" /> : <Link key={i} href="/settings/business#bp-photos" className="em" aria-label="Add a photo">+</Link>;
        })}
      </div>
      <div className="ppv-ch">
        {services.length ? services.slice(0, 4).map((x) => <span key={x}>{x}</span>) : <Link href="/settings/business#bp-about">Add your trades</Link>}
      </div>
      <div className="ppv-pb"><span><b>Profile {pct}%</b> complete</span><span>{left ? `${left} thing${left > 1 ? 's' : ''} left` : 'All set'}</span></div>
      <div className="bar ppv-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
      <div className="ppv-ck">
        {items.map((i) => (
          <Link key={i.label} href={i.href}><span>{i.ok ? '✓ ' : ''}{i.label}</span><b className={i.ok ? 'y' : 'n'}>{i.ok ? 'Done' : `${i.cta} ›`}</b></Link>
        ))}
        <div className="ppv-opt">Optional, not counted in the percent</div>
        {extras.map((i) => (
          <Link key={i.label} href={i.href}><span>{i.ok ? '✓ ' : ''}{i.label}</span><b className={i.ok ? 'y' : 'n'}>{i.ok ? 'Done' : 'Add ›'}</b></Link>
        ))}
      </div>
    </div>
  );
}
