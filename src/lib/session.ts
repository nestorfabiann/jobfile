import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';

export type Role = 'contractor' | 'homeowner';

export async function requireUser() {
  const sb = supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const { data: prof } = await sb.from('profiles').select('banned_at').eq('id', user.id).maybeSingle();
  if (prof?.banned_at) redirect('/banned');
  // "Sign out everywhere" by an admin: a session issued before that moment is ended. Skipped until the 017 column exists.
  try {
    const { data: rv } = await sb.from('profiles').select('sessions_revoked_at').eq('id', user.id).maybeSingle();
    const at = (rv as { sessions_revoked_at?: string | null } | null)?.sessions_revoked_at;
    if (at) {
      const { data: { session } } = await sb.auth.getSession();
      const part = session?.access_token?.split('.')[1];
      const iat = part ? (JSON.parse(Buffer.from(part, 'base64url').toString()) as { iat?: number }).iat : undefined;
      if (iat && iat * 1000 < new Date(at).getTime()) {
        await sb.auth.signOut();
        redirect('/login');
      }
    }
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw e;
  }
  return { sb, user };
}

/** The person's role on a project, or null if they have no access. Uses row level security. */
export async function roleFor(
  sb: ReturnType<typeof supabaseServer>,
  projectId: string,
  userId: string,
): Promise<Role | null> {
  const { data: pm } = await sb
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  if (pm) return pm.role as Role;

  const { data: p } = await sb.from('projects').select('company_id').eq('id', projectId).maybeSingle();
  if (!p) return null;
  const { data: cm } = await sb
    .from('company_members')
    .select('role')
    .eq('company_id', p.company_id)
    .eq('user_id', userId)
    .maybeSingle();
  return cm ? 'contractor' : null;
}
