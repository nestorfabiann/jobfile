import { NextResponse } from 'next/server';
import { audit, requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/** Admin-only. Writes an audit entry, then redirects to a 60 second link to the private proof file. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { user, db } = await requireAdmin('verification');
  const { data: c } = await db.from('company_credentials').select('id,company_id,proof_path,name').eq('id', params.id).maybeSingle<any>();
  if (!c?.proof_path) return new NextResponse('Not found', { status: 404 });
  const { data } = await db.storage.from('company-docs').createSignedUrl(c.proof_path as string, 60);
  if (!data?.signedUrl) return new NextResponse('Could not open the file', { status: 500 });
  await audit(user, 'credential_view', { type: 'company', id: c.company_id as string }, { name: c.name });
  return NextResponse.redirect(data.signedUrl);
}
