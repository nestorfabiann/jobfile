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

/**
 * Call at the top of every admin page AND every admin server action.
 * A layout check alone does not protect server actions. Non-admins see a normal 404.
 */
export async function requireAdmin() {
  const { sb, user } = await requireUser();
  if (!isAdminEmail(user.email, !!user.email_confirmed_at)) notFound();
  return { sb, user, db: supabaseAdmin() };
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
