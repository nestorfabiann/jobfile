import { cache } from 'react';
import { notFound } from 'next/navigation';
import { requireUser, roleFor } from './session';
import { supabaseAdmin } from './supabase/server';

/**
 * Loads a project for the signed-in person, or 404s. Row level security hides projects they do not belong to.
 * Cached per request so the layout and the page can both call it without repeating the queries.
 */
export const loadProject = cache(async (id: string) => {
  const { sb, user } = await requireUser();

  const { data: project } = await sb
    .from('projects')
    .select('id,name,address,homeowner_name,homeowner_email,is_homestead,company_id')
    .eq('id', id)
    .maybeSingle();
  if (!project) notFound();

  const role = await roleFor(sb, project.id, user.id);
  if (!role) notFound();

  // Access is proven above, so the company name and homeowner login status can be read with the server key.
  const admin = supabaseAdmin();
  const [{ data: company }, { count }] = await Promise.all([
    admin.from('companies').select('name').eq('id', project.company_id).single(),
    admin
      .from('project_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .eq('role', 'homeowner'),
  ]);

  return {
    sb,
    user,
    project,
    role,
    contractorName: (company?.name as string | undefined) ?? 'Contractor',
    homeownerName: (project.homeowner_name as string) || 'Homeowner',
    homeownerJoined: (count ?? 0) > 0,
  };
});
