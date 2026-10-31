import { NextResponse } from 'next/server';
import { loadProject } from '@/lib/project';
import {
  agreementText,
  type AgreementRow,
  type ChangeOrder,
  type Item,
  type Milestone,
  type Signature,
} from '@/lib/agreement';

// A plain-text copy of the agreement. PDF output comes later.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { sb, project, contractorName, homeownerName } = await loadProject(params.id);

  const { data: a } = await sb.from('agreements').select('*').eq('project_id', project.id).maybeSingle();
  if (!a) return new NextResponse('No agreement to download yet.', { status: 404 });

  const [{ data: items }, { data: ms }, { data: sigs }, { data: cos }] = await Promise.all([
    sb.from('agreement_items').select('*').eq('project_id', project.id).order('position'),
    sb.from('agreement_milestones').select('*').eq('project_id', project.id).order('position'),
    sb.from('agreement_signatures').select('role,typed_name,revision,signed_at').eq('project_id', project.id),
    sb.from('change_orders').select('*').eq('project_id', project.id).order('number'),
  ]);

  const text = agreementText({
    projectName: project.name,
    address: project.address,
    homeowner: homeownerName,
    contractor: contractorName,
    agreement: a as AgreementRow,
    items: (items ?? []) as Item[],
    milestones: (ms ?? []).map((m) => ({ ...m, pct: Number(m.pct) })) as Milestone[],
    signatures: (sigs ?? []) as Signature[],
    changes: (cos ?? []) as ChangeOrder[],
  });

  const file = `${project.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'agreement'}-agreement.txt`;
  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file}"`,
    },
  });
}
