'use server';

import { revalidatePath } from 'next/cache';
import { audit, isAdminEmail, requireAdmin } from '@/lib/admin';
import { notifyUsers } from '@/lib/notify';
import { JOB_TYPES } from '@/lib/marketplace';
import type { Result } from './actions';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const fail = (error: string): Result => ({ ok: false, error });
const reasonOf = (f: FormData) => str(f, 'reason').slice(0, 500);
const wantsTell = (f: FormData) => f.get('tell') === 'on';

async function tell(userIds: string[], title: string, body: string) {
  if (!userIds.length) return;
  await notifyUsers({ userIds, projectId: null, kind: 'admin', title, body });
}

/** Edit a person's name, phone and email. Every change is written to the audit log with the old and new value. */
export async function editUser(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'user_id');
  const reason = reasonOf(f);
  if (!reason || reason.length < 4) return fail('Add a short reason. It goes in the audit log.');
  const { data: u } = await db.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!u) return fail('User not found.');
  const next = { full_name: str(f, 'full_name').slice(0, 120), phone: str(f, 'phone').slice(0, 40), email: str(f, 'email').toLowerCase().slice(0, 200) };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next.email)) return fail('Enter a valid email address.');
  const before: Record<string, string> = { full_name: u.full_name, phone: u.phone, email: u.email };
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== before[k]);
  if (!changed.length) return fail('Nothing was changed.');
  if (changed.includes('email')) {
    if (isAdminEmail(u.email) && u.id !== me.id) return fail('Admin email addresses cannot be changed here.');
    const { data: dup } = await db.from('profiles').select('id').eq('email', next.email).neq('id', id).maybeSingle();
    if (dup) return fail('Another account already uses that email.');
    const { error } = await db.auth.admin.updateUserById(id, { email: next.email, email_confirm: true });
    if (error) return fail(`Could not change the email: ${error.message}`);
  }
  await db.from('profiles').update({ ...next, ...(changed.includes('email') ? { sessions_revoked_at: new Date().toISOString() } : {}) }).eq('id', id);
  await audit(me, 'edit_user', { type: 'user', id }, { reason, changes: Object.fromEntries(changed.map((k) => [k, { from: before[k], to: next[k] }])) });
  if (wantsTell(f)) await tell([id], 'An admin updated your profile', `Changed: ${changed.map((k) => ({ full_name: 'name', phone: 'phone', email: 'email' })[k]).join(', ')}.`);
  revalidatePath(`/admin/users/${id}`);
  return { ok: true, message: `Saved. Changed: ${changed.join(', ')}.` };
}

async function userGuard(f: FormData) {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'user_id');
  const reason = reasonOf(f);
  if (reason.length < 4) return { err: fail('Add a short reason. It goes in the audit log.') } as const;
  const { data: u } = await db.from('profiles').select('id,email').eq('id', id).maybeSingle();
  if (!u) return { err: fail('User not found.') } as const;
  if (id === me.id || isAdminEmail(u.email)) return { err: fail('This cannot be done to an admin account.') } as const;
  return { me, db, id, reason, u } as const;
}

export async function signOutEverywhere(_: Result | null, f: FormData): Promise<Result> {
  const g = await userGuard(f);
  if ('err' in g) return g.err;
  await g.db.from('profiles').update({ sessions_revoked_at: new Date().toISOString() }).eq('id', g.id);
  await audit(g.me, 'sign_out_everywhere', { type: 'user', id: g.id }, { reason: g.reason, email: g.u.email });
  return { ok: true, message: 'Done. Their open sessions end the next time they load a page.' };
}

export async function alertsOff(_: Result | null, f: FormData): Promise<Result> {
  const g = await userGuard(f);
  if ('err' in g) return g.err;
  await g.db.from('profiles').update({ notify_email: false, notify_sms: false }).eq('id', g.id);
  await audit(g.me, 'alerts_off', { type: 'user', id: g.id }, { reason: g.reason, email: g.u.email });
  revalidatePath(`/admin/users/${g.id}`);
  return { ok: true, message: 'Email and text alerts are off for this person.' };
}

/** Deletes an account only when nothing depends on it. Otherwise suspend instead. */
export async function deleteUser(_: Result | null, f: FormData): Promise<Result> {
  const g = await userGuard(f);
  if ('err' in g) return g.err;
  const c = async (table: string, col: string) => (await g.db.from(table).select('*', { count: 'exact', head: true }).eq(col, g.id)).count ?? 0;
  const used = (await c('project_members', 'user_id')) + (await c('company_members', 'user_id')) + (await c('marketplace_listings', 'homeowner_id'));
  if (used > 0) return fail('This person has projects, a company or posted jobs. Suspend them instead.');
  const { error } = await g.db.auth.admin.deleteUser(g.id);
  if (error) return fail(`Could not delete: ${error.message}`);
  await audit(g.me, 'delete_user', { type: 'user', id: g.id }, { reason: g.reason, email: g.u.email });
  revalidatePath('/admin/users');
  return { ok: true, message: `${g.u.email} was deleted.` };
}

export async function addNote(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin();
  const type = str(f, 'subject_type') === 'company' ? 'company' : 'user';
  const id = str(f, 'subject_id');
  const body = str(f, 'body').slice(0, 2000);
  if (!id || !body) return fail('Write a note first.');
  const { error } = await db.from('admin_notes').insert({ subject_type: type, subject_id: id, author_id: me.id, author_email: me.email ?? '', body });
  if (error) return fail('Could not save the note. Run the 017 SQL step first.');
  revalidatePath(type === 'company' ? `/admin/companies/${id}` : `/admin/users/${id}`);
  return { ok: true, message: 'Note saved.' };
}

async function companyGuard(f: FormData) {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'company_id');
  const reason = reasonOf(f);
  if (reason.length < 4) return { err: fail('Add a short reason. It goes in the audit log.') } as const;
  const { data: c } = await db.from('companies').select('*').eq('id', id).maybeSingle<any>();
  if (!c) return { err: fail('Company not found.') } as const;
  const { data: mem } = await db.from('company_members').select('user_id,role').eq('company_id', id);
  const owners = (mem ?? []).filter((m: any) => m.role === 'owner').map((m: any) => m.user_id as string);
  const everyone = (mem ?? []).map((m: any) => m.user_id as string);
  return { me, db, id, reason, c, owners, everyone, mem: (mem ?? []) as { user_id: string; role: string }[] } as const;
}

export async function editCompany(_: Result | null, f: FormData): Promise<Result> {
  const g = await companyGuard(f);
  if ('err' in g) return g.err;
  const trades = str(f, 'trades').split(',').map((t) => t.trim()).filter(Boolean);
  const bad = trades.filter((t) => !JOB_TYPES[t]);
  if (bad.length) return fail(`Not a trade on Jobfile: ${bad.join(', ')}.`);
  const zip = str(f, 'business_zip');
  if (zip && !/^\d{5}$/.test(zip)) return fail('ZIP must be 5 digits.');
  const radius = str(f, 'service_radius_mi');
  if (radius && !/^\d{1,3}$/.test(radius)) return fail('Miles must be a number from 1 to 500.');
  const name = str(f, 'name').slice(0, 120);
  if (!name) return fail('The business needs a name.');
  const next: Record<string, unknown> = { name, about: str(f, 'about').slice(0, 800), trades, business_zip: zip || null, service_radius_mi: radius ? Math.min(500, Math.max(1, parseInt(radius, 10))) : null };
  const before: Record<string, unknown> = { name: g.c.name, about: g.c.about ?? '', trades: g.c.trades ?? [], business_zip: g.c.business_zip ?? null, service_radius_mi: g.c.service_radius_mi ?? null };
  const changed = Object.keys(next).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(before[k]));
  if (!changed.length) return fail('Nothing was changed.');
  const { error } = await g.db.from('companies').update(next).eq('id', g.id);
  if (error) return fail(`Could not save: ${error.message}`);
  await audit(g.me, 'edit_company', { type: 'company', id: g.id }, { reason: g.reason, changes: Object.fromEntries(changed.map((k) => [k, { from: before[k], to: next[k] }])) });
  if (wantsTell(f)) await tell(g.everyone, 'An admin updated your business profile', `Changed: ${changed.join(', ')}.`);
  revalidatePath(`/admin/companies/${g.id}`);
  return { ok: true, message: `Saved. Changed: ${changed.join(', ')}.` };
}

export async function setVerified(_: Result | null, f: FormData): Promise<Result> {
  const g = await companyGuard(f);
  if ('err' in g) return g.err;
  const on = !g.c.verified_at;
  const { error } = await g.db.from('companies').update({ verified_at: on ? new Date().toISOString() : null }).eq('id', g.id);
  if (error) return fail('Could not save. Run the 017 SQL step first.');
  await audit(g.me, on ? 'verify_company' : 'unverify_company', { type: 'company', id: g.id }, { reason: g.reason, name: g.c.name });
  revalidatePath(`/admin/companies/${g.id}`);
  return { ok: true, message: on ? 'Marked as verified.' : 'Verified mark removed.' };
}

export async function setHidden(_: Result | null, f: FormData): Promise<Result> {
  const g = await companyGuard(f);
  if ('err' in g) return g.err;
  const on = !g.c.hidden_at;
  const { error } = await g.db.from('companies').update(on ? { hidden_at: new Date().toISOString(), hidden_reason: g.reason } : { hidden_at: null, hidden_reason: '' }).eq('id', g.id);
  if (error) return fail('Could not save. Run the 017 SQL step first.');
  await audit(g.me, on ? 'hide_company' : 'unhide_company', { type: 'company', id: g.id }, { reason: g.reason, name: g.c.name });
  if (wantsTell(f)) await tell(g.everyone, on ? 'Your business is hidden from the marketplace' : 'Your business is visible again', on ? `Reason: ${g.reason}` : 'You can bid on projects again.');
  revalidatePath(`/admin/companies/${g.id}`);
  return { ok: true, message: on ? 'Hidden from the marketplace. They cannot place new bids.' : 'Visible again.' };
}

export async function removeLogo(_: Result | null, f: FormData): Promise<Result> {
  const g = await companyGuard(f);
  if ('err' in g) return g.err;
  if (!g.c.logo_path) return fail('There is no logo.');
  await g.db.storage.from('company-photos').remove([g.c.logo_path as string]);
  await g.db.from('companies').update({ logo_path: null }).eq('id', g.id);
  await audit(g.me, 'remove_logo', { type: 'company', id: g.id }, { reason: g.reason });
  if (wantsTell(f)) await tell(g.everyone, 'An admin removed your logo', `Reason: ${g.reason}`);
  revalidatePath(`/admin/companies/${g.id}`);
  return { ok: true, message: 'Logo removed.' };
}

export async function removePhoto(_: Result | null, f: FormData): Promise<Result> {
  const g = await companyGuard(f);
  if ('err' in g) return g.err;
  const pid = str(f, 'photo_id');
  const { data: ph } = await g.db.from('company_photos').select('path').eq('id', pid).eq('company_id', g.id).maybeSingle();
  if (!ph) return fail('Photo not found.');
  await g.db.storage.from('company-photos').remove([ph.path as string]);
  await g.db.from('company_photos').delete().eq('id', pid).eq('company_id', g.id);
  await audit(g.me, 'remove_company_photo', { type: 'company', id: g.id }, { reason: g.reason });
  if (wantsTell(f)) await tell(g.everyone, 'An admin removed a photo from your profile', `Reason: ${g.reason}`);
  revalidatePath(`/admin/companies/${g.id}`);
  return { ok: true, message: 'Photo removed.' };
}

export async function moveOwner(_: Result | null, f: FormData): Promise<Result> {
  const g = await companyGuard(f);
  if ('err' in g) return g.err;
  const to = str(f, 'new_owner');
  if (!g.mem.some((m) => m.user_id === to)) return fail('Pick a person who works at this company.');
  await g.db.from('company_members').update({ role: 'staff' }).eq('company_id', g.id).eq('role', 'owner');
  await g.db.from('company_members').update({ role: 'owner' }).eq('company_id', g.id).eq('user_id', to);
  await audit(g.me, 'move_owner', { type: 'company', id: g.id }, { reason: g.reason, from: g.owners, to });
  revalidatePath(`/admin/companies/${g.id}`);
  return { ok: true, message: 'Ownership moved.' };
}
