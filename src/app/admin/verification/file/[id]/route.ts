import { NextResponse } from 'next/server';
import { audit, requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/** Admin-only. Writes an audit entry, then redirects to a 60 second link to the private file. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { user, db } = await requireAdmin();
  const { data: ins } = await db.from('company_insurance').select('id,company_id,path,kind').eq('id', params.id).maybeSingle();
  if (!ins) return new NextResponse('Not found', { status: 404 });
  const { data } = await db.storage.from('company-docs').createSignedUrl(ins.path as string, 60);
  if (!data?.signedUrl) return new NextResponse('Could not open the file', { status: 500 });
  await audit(user, 'insurance_view', { type: 'company', id: ins.company_id as string }, { kind: ins.kind });
  return NextResponse.redirect(data.signedUrl);
}
