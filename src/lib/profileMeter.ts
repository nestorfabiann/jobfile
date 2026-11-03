import { supabaseAdmin } from '@/lib/supabase/server';
import { isCurrent } from '@/lib/companyProfile';

export type MeterItem = { label: string; ok: boolean; cta: string; href: string };

/** How complete a contractor's public profile is. Reads defensively, so missing columns just count as empty. */
export async function profileMeter(companyId: string): Promise<{ pct: number; items: MeterItem[] }> {
  const db = supabaseAdmin();
  const [{ data: co }, { count: photos }, { data: ins }] = await Promise.all([
    db.from('companies').select('*').eq('id', companyId).maybeSingle(),
    db.from('company_photos').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    db.from('company_insurance').select('status,expires_on').eq('company_id', companyId),
  ]);
  const c = (co ?? {}) as any;
  const hasIns = ((ins ?? []) as any[]).some((i) => isCurrent(i) || i.status === 'pending');
  const items: MeterItem[] = [
    { label: 'Business name and trades', ok: !!String(c.name ?? '').trim() && (c.trades ?? []).length > 0, cta: 'Add', href: '/settings/business#bp-about' },
    { label: 'Service area and ZIP', ok: /^\d{5}$/.test(c.business_zip ?? '') && !!c.service_radius_mi, cta: 'Add', href: '/settings/business#bp-where' },
    { label: 'Company logo', ok: !!c.logo_path, cta: 'Add', href: '/settings/business#bp-logo' },
    { label: '3 or more work photos', ok: (photos ?? 0) >= 3, cta: 'Add', href: '/settings/business#bp-photos' },
    { label: 'Insurance certificate', ok: hasIns, cta: 'Add', href: '/settings/business#bp-ins' },
    { label: 'Short “About us” text', ok: String(c.about ?? '').trim().length >= 40, cta: 'Write', href: '/settings/business#bp-about' },
    { label: 'Year you started', ok: !!c.year_started, cta: 'Add', href: '/settings/business#bp-where' },
  ];
  const done = items.filter((i) => i.ok).length;
  return { pct: Math.round((done / items.length) * 100), items };
}
