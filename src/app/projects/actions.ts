'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { APP_URL, notifyUsers, sendEmail } from '@/lib/notify';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function fail(msg: string): never {
  redirect('/projects?error=' + encodeURIComponent(msg));
}

/** A contractor sets up their company. They become its owner. */
export async function createCompany(formData: FormData) {
  const { user } = await requireUser();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) fail('Enter your company name.');

  const admin = supabaseAdmin();
  const { data: company, error } = await admin
    .from('companies')
    .insert({ name, created_by: user.id })
    .select('id')
    .single();
  if (error || !company) fail('Could not create the company. Try again.');

  await admin.from('company_members').insert({ company_id: company.id, user_id: user.id, role: 'owner' });
  revalidatePath('/projects');
  redirect('/projects');
}

/** A contractor opens a project and invites the homeowner by email. */
export async function createProject(formData: FormData) {
  const { sb, user } = await requireUser();
  const companyId = String(formData.get('company_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const homeownerName = String(formData.get('homeowner_name') ?? '').trim();
  const homeownerEmail = String(formData.get('homeowner_email') ?? '').trim().toLowerCase();
  const isHomestead = formData.get('is_homestead') === 'on';

  if (!name) fail('Give the project a name.');
  if (!EMAIL.test(homeownerEmail)) fail('Enter the homeowner’s email address.');
  if (homeownerEmail === (user.email ?? '').toLowerCase())
    fail('The homeowner email must be different from yours.');

  // Row level security only shows the person their own memberships, so this proves they belong to the company.
  const { data: membership } = await sb
    .from('company_members')
    .select('company_id, companies(name)')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) fail('You do not have access to that company.');
  const companyName: string = (membership as { companies?: { name?: string } }).companies?.name ?? 'Your contractor';

  const admin = supabaseAdmin();
  const { data: project, error } = await admin
    .from('projects')
    .insert({
      company_id: companyId,
      name,
      address,
      homeowner_name: homeownerName,
      homeowner_email: homeownerEmail,
      is_homestead: isHomestead,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error || !project) fail('Could not create the project. Try again.');

  await admin.from('project_members').insert({ project_id: project.id, user_id: user.id, role: 'contractor' });

  // If the homeowner already has a login, attach them now. Otherwise the sign-up trigger attaches them later.
  const { data: existing } = await admin.from('profiles').select('id').eq('email', homeownerEmail).maybeSingle();
  if (existing) {
    await admin.from('project_members').insert({ project_id: project.id, user_id: existing.id, role: 'homeowner' });
    await notifyUsers({
      userIds: [existing.id],
      projectId: project.id,
      kind: 'invite',
      path: `/projects/${project.id}`,
      title: `${companyName} added you to ${name}`,
      body: `${companyName} opened a project for you on Jobfile. You can message them, review the agreement and follow progress there.`,
    });
  } else {
    await sendEmail({
      to: homeownerEmail,
      subject: `${companyName} invited you to ${name}`,
      text: `${companyName} opened a project for you on Jobfile. Sign in with this email address (${homeownerEmail}) to message them, review the agreement and follow progress.`,
      link: `${APP_URL()}/login?email=${encodeURIComponent(homeownerEmail)}`,
    });
  }

  revalidatePath('/projects');
  redirect(`/projects/${project.id}/overview`);
}

/** Hide or show the "Why run the job in Jobfile" card. Remembered for a year in a cookie. */
export async function setWhy(formData: FormData) {
  await requireUser();
  const show = formData.get('show') === '1';
  cookies().set('jf_why', show ? 'show' : 'hidden', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 365 * 86400, path: '/' });
  revalidatePath('/projects');
}
