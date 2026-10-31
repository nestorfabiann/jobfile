import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';

export type Role = 'contractor' | 'homeowner';

export async function requireUser() {
  const sb = supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/login');
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
