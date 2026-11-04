import { NextResponse } from 'next/server';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildProjectRecord } from '@/lib/projectRecord';
import { revealedBy, type ReviewRow } from '@/lib/reviews';
import { jpegInfo } from '@/lib/pdfDoc';
import { milestoneAmounts, sumItems, type AgreementRow, type ChangeOrder, type Item, type Milestone, type Signature } from '@/lib/agreement';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_PHOTOS = 24;
const MAX_PHOTO_BYTES = 3_000_000;

// One PDF with the whole project. Both people on the project can download it.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { sb, project, contractorName, homeownerName } = await loadProject(params.id);
  const q = new URL(req.url).searchParams;
  const choose = q.get('go') === '1';
  const on = (k: string) => (choose ? q.get(k) === 'on' : true);
  const include = { messages: on('messages'), photos: on('photos'), payments: on('payments') };

  const [{ data: a }, { data: items }, { data: ms }, { data: sigs }, { data: cos }, { data: pays }, { data: msgs }, { data: phs }] = await Promise.all([
    sb.from('agreements').select('*').eq('project_id', project.id).maybeSingle(),
    sb.from('agreement_items').select('*').eq('project_id', project.id).order('position'),
    sb.from('agreement_milestones').select('*').eq('project_id', project.id).order('position'),
    sb.from('agreement_signatures').select('role,typed_name,revision,signed_at').eq('project_id', project.id),
    sb.from('change_orders').select('*').eq('project_id', project.id).order('number'),
    include.payments ? sb.from('payments').select('*').eq('project_id', project.id).order('paid_on') : Promise.resolve({ data: [] }),
    include.messages ? sb.from('messages').select('created_at,sender_role,tag,body').eq('project_id', project.id).order('created_at').limit(2000) : Promise.resolve({ data: [] }),
    include.photos ? sb.from('photos').select('*').eq('project_id', project.id).order('created_at').limit(300) : Promise.resolve({ data: [] }),
  ]);

  // Photos: only JPEGs are placed, newest kept if there are too many, and the total size is capped.
  const admin = supabaseAdmin();
  const rows = ((phs ?? []) as any[]).slice(-MAX_PHOTOS);
  let omitted = ((phs ?? []) as any[]).length - rows.length;
  let bytes = 0;
  const photos: any[] = [];
  for (let i = 0; i < rows.length; i += 6) {
    const batch = await Promise.all(
      rows.slice(i, i + 6).map(async (p) => {
        try {
          const { data } = await admin.storage.from('project-photos').download(p.path as string);
          return data ? Buffer.from(await data.arrayBuffer()) : null;
        } catch {
          return null;
        }
      }),
    );
    batch.forEach((buf, k) => {
      const p = rows[i + k];
      let data: Buffer | null = buf && jpegInfo(buf) ? buf : null;
      if (data && bytes + data.length > MAX_PHOTO_BYTES) { omitted++; return; }
      if (data) bytes += data.length;
      photos.push({ created_at: p.created_at, kind: p.kind, status: p.status, caption: p.caption ?? '', uploader_role: p.uploader_role, data });
    });
  }
  // Ratings follow the same reveal rule as the Rating tab.
  const { data: rv } = await admin.from('reviews').select('*').eq('project_id', project.id);
  const reviewRows = ((rv ?? []) as ReviewRow[]).filter((x) => !x.hidden_at);
  const reviews = reviewRows.length && project.completed_at && revealedBy(project.completed_at as string, reviewRows.length > 1)
    ? reviewRows.map((x) => ({ reviewer_role: x.reviewer_role, overall: x.overall, comment: x.comment, reply: x.reply ?? null, created_at: x.created_at }))
    : [];

  // Payments come from the payment schedule: each agreed milestone, and each approved change order that was billed.
  const msList = (ms ?? []).map((m: any) => ({ ...m, pct: Number(m.pct) })) as (Milestone & Record<string, any>)[];
  const due = milestoneAmounts(sumItems((items ?? []) as Item[]), msList);
  const asRow = (label: string, amount: number, x: Record<string, any>) => ({
    paid_on: (x.paid_at as string) ?? (x.confirmed_at as string) ?? '',
    amount_cents: amount,
    method: (x.paid_method as string) ?? 'other',
    status: x.pay_status === 'confirmed' ? 'receipt confirmed' : 'awaiting confirmation',
    note: `${label}${x.pay_status === 'confirmed' ? (x.lien_waiver ? '. Lien waiver provided.' : '. No lien waiver recorded.') : ''}`,
    recorded_role: 'homeowner',
  });
  const payRows = !include.payments ? [] : [
    ...msList.map((m, i) => ({ m, i })).filter(({ m }) => m.pay_status === 'paid' || m.pay_status === 'confirmed').map(({ m, i }) => asRow(m.label, due[i], m)),
    ...((cos ?? []) as any[]).filter((c) => c.status === 'approved' && Number(c.cost_cents) > 0 && (c.pay_status === 'paid' || c.pay_status === 'confirmed')).map((c) => asRow(`CO-${c.number}: ${c.title}`, Number(c.cost_cents), c)),
  ].sort((a, b) => a.paid_on.localeCompare(b.paid_on));

  const pdf = buildProjectRecord({
    projectName: project.name,
    address: project.address,
    homeowner: homeownerName,
    contractor: contractorName,
    createdAt: project.created_at as string,
    completedAt: (project.completed_at as string | null) ?? null,
    agreement: (a as AgreementRow | null) ?? null,
    items: (items ?? []) as Item[],
    milestones: (ms ?? []).map((m: any) => ({ ...m, pct: Number(m.pct) })) as Milestone[],
    signatures: (sigs ?? []) as Signature[],
    changes: (cos ?? []) as ChangeOrder[],
    payments: payRows,
    messages: (msgs ?? []) as any[],
    photos,
    photosOmitted: omitted,
    reviews,
    include,
  });

  const file = `${project.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'project'}-record.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${file}"`, 'Cache-Control': 'private, no-store' },
  });
}
