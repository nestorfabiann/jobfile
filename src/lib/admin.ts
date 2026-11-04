import { notFound } from 'next/navigation';
import { requireUser } from './session';
import { supabaseAdmin } from './supabase/server';

/** Admins are listed in the ADMIN_EMAILS environment variable (comma separated). Empty means nobody is an admin. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined, confirmed = true): boolean {
  if (!email || !confirmed) return false;
  return adminEmails().includes(email.toLowerCase());
}

export type AdminRole = 'owner' | 'moderator' | 'verifier' | 'support';
export type Area = 'reviews' | 'help' | 'listings' | 'verification' | 'view' | 'audit';

/** What each team role may open. Owners can open everything. A page or action with no area is Owner only. */
export const ROLE_AREAS: Record<Exclude<AdminRole, 'owner'>, Area[]> = {
  moderator: ['reviews', 'help', 'listings', 'audit'],
  verifier: ['verification', 'audit'],
  support: ['help', 'view', 'audit'],
};
export const TEAM_ROLES = ['moderator', 'verifier', 'support'] as const;
export const ROLE_LABEL: Record<AdminRole, string> = { owner: 'Owner', moderator: 'Moderator', verifier: 'Verifier', support: 'Support' };

/** The signed-in person's admin role, or null. Owners are the ADMIN_EMAILS list; everyone else comes from the admin_team table. */
export async function adminRoleOf(email: string | null | undefined, confirmed = true): Promise<AdminRole | null> {
  if (!email || !confirmed) return null;
  if (isAdminEmail(email)) return 'owner';
  try {
    const { data } = await supabaseAdmin().from('admin_team').select('role').eq('email', email.toLowerCase()).maybeSingle();
    const r = (data as { role?: string } | null)?.role;
    return r === 'moderator' || r === 'verifier' || r === 'support' ? r : null;
  } catch {
    return null; // team table not created yet
  }
}

/** True for an Owner or any team member. Used to keep admin accounts from being suspended or edited by other admins. */
export async function isTeamAdmin(email: string | null | undefined): Promise<boolean> {
  return (await adminRoleOf(email, true)) !== null;
}

/**
 * Call at the top of every admin page AND every admin server action.
 * A layout check alone does not protect server actions. Non-admins see a normal 404.
 * With no area, only an Owner gets in. With an area, an Owner or a role that includes it gets in.
 */
export async function requireAdmin(area?: Area) {
  const { sb, user } = await requireUser();
  const role = await adminRoleOf(user.email, !!user.email_confirmed_at);
  if (!role) return notFound();
  if (role !== 'owner' && (!area || !ROLE_AREAS[role].includes(area))) return notFound();
  return { sb, user, db: supabaseAdmin(), role: role as AdminRole };
}

/** Any admin or team member, with no page check. Only the admin layout and the Admin home redirect use this. */
export async function requireAnyAdmin() {
  const { sb, user } = await requireUser();
  const role = await adminRoleOf(user.email, !!user.email_confirmed_at);
  if (!role) return notFound();
  return { sb, user, db: supabaseAdmin(), role: role as AdminRole };
}

export async function audit(
  admin: { id: string; email?: string | null },
  action: string,
  target: { type?: string; id?: string } = {},
  detail: Record<string, unknown> = {},
) {
  await supabaseAdmin().from('admin_audit').insert({
    admin_id: admin.id,
    admin_email: admin.email ?? '',
    action,
    target_type: target.type ?? '',
    target_id: target.id ?? '',
    detail,
  });
}
