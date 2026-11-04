'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { audit, adminEmails, requireAdmin, TEAM_ROLES } from '@/lib/admin';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const back = (q: string) => redirect(`/admin/team?${q}`);

export async function addTeamMember(formData: FormData) {
  const { user: me, db } = await requireAdmin(); // Owner only
  const email = String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  const role = String(formData.get('role') ?? '');
  if (!EMAIL.test(email)) back('error=Enter+a+valid+email+address.');
  if (!(TEAM_ROLES as readonly string[]).includes(role)) back('error=Pick+a+role.');
  if (adminEmails().includes(email)) back('error=That+person+is+already+an+Owner.');
  const { error } = await db.from('admin_team').upsert({ email, name, role, added_by: me.email ?? '' }, { onConflict: 'email' });
  if (error) back('error=Could+not+save.+Check+that+the+database+step+was+run.');
  await audit(me, 'team_add', { type: 'admin_team', id: email }, { role });
  revalidatePath('/admin/team');
  back('saved=1');
}

export async function changeTeamRole(formData: FormData) {
  const { user: me, db } = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!(TEAM_ROLES as readonly string[]).includes(role)) back('error=Pick+a+role.');
  const { data: row } = await db.from('admin_team').select('email').eq('id', id).maybeSingle();
  if (!row) back('error=Person+not+found.');
  await db.from('admin_team').update({ role }).eq('id', id);
  await audit(me, 'team_role', { type: 'admin_team', id: String(row!.email) }, { role });
  revalidatePath('/admin/team');
  back('saved=1');
}

export async function removeTeamMember(formData: FormData) {
  const { user: me, db } = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const { data: row } = await db.from('admin_team').select('email').eq('id', id).maybeSingle();
  if (!row) back('error=Person+not+found.');
  await db.from('admin_team').delete().eq('id', id);
  await audit(me, 'team_remove', { type: 'admin_team', id: String(row!.email) });
  revalidatePath('/admin/team');
  back('removed=1');
}
