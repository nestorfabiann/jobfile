import { NextResponse } from 'next/server';
import { audit, requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/** Owner-only. Writes an audit entry, then redirects to a 60 second link to the private photo. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { user, db } = await requireAdmin();
  const { data: r } = await db.from('company_id_checks').select('id,company_id,photo_path,status').eq('id', params.id).maybeSingle<any>();
  if (!r?.photo_path || r.status !== 'pending') return new NextResponse('Not found', { status: 404 });
  const { data } = await db.storage.from('company-docs').createSignedUrl(r.photo_path as string, 60);
  if (!data?.signedUrl) return new NextResponse('Could not open the file', { status: 500 });
  await audit(user, 'id_view', { type: 'company', id: r.company_id as string }, {});
  return NextResponse.redirect(data.signedUrl);
}
