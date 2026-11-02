'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { APP_URL, notifyUsers, sendEmail } from '@/lib/notify';
import { EMAIL, isExpired, loadInvite, MAX_OPEN, MAX_PER_DAY, MAX_SENDS, type Invite } from '@/lib/invites';

const txt = (f: FormData, k: string, n: number) => String(f.get(k) ?? '').trim().slice(0, n);
function back(path: string, msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`);
}

/** Tells the contractor. Existing users get an in-app alert plus email or text; new ones get an email with a sign-in link. */
async function sendInvite(inv: Pick<Invite, 'contractor_email' | 'homeowner_name' | 'project_name' | 'message'>, homeownerLabel: string) {
  const db = supabaseAdmin();
  const title = `${homeownerLabel} invited you to a project on Jobfile`;
  const body = `${homeownerLabel} wants to work with you on "${inv.project_name}".${inv.message ? `\n\n"${inv.message}"` : ''}\n\nSign in with this email address (${inv.contractor_email}) and open Projects to accept or decline.`;
  const { data: existing } = await db.from('profiles').select('id').eq('email', inv.contractor_email).maybeSingle();
  if (existing) {
    await notifyUsers({ userIds: [existing.id as string], projectId: null, kind: 'invite', title, body, force: true });
  } else {
    await sendEmail({ to: inv.contractor_email, subject: title, text: body, link: `${APP_URL()}/login?email=${encodeURIComponent(inv.contractor_email)}` });
  }
}

export async function createInvite(formData: FormData) {
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const projectName = txt(formData, 'name', 120);
  const email = txt(formData, 'contractor_email', 200).toLowerCase();
  if (!projectName) back('/invites/new', 'Give the project a name.');
  if (!EMAIL.test(email)) back('/invites/new', 'Enter your contractor’s email address.');
  if (email === (user.email ?? '').toLowerCase()) back('/invites/new', 'The contractor email must be different from yours.');

  const { count: open } = await db.from('project_invites').select('id', { count: 'exact', head: true }).eq('homeowner_id', user.id).eq('status', 'pending').gt('expires_at', new Date().toISOString());
  if ((open ?? 0) >= MAX_OPEN) back('/invites/new', `You have ${MAX_OPEN} invites waiting. Cancel one or wait for an answer first.`);
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: recent } = await db.from('project_invites').select('id', { count: 'exact', head: true }).eq('homeowner_id', user.id).gt('created_at', since);
  if ((recent ?? 0) >= MAX_PER_DAY) back('/invites/new', 'You have sent a lot of invites today. Try again tomorrow.');

  const { data: prof } = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const homeownerName = ((prof?.full_name as string | undefined) ?? '').trim().slice(0, 120);
  const row = {
    homeowner_id: user.id,
    homeowner_name: homeownerName,
    project_name: projectName,
    address: txt(formData, 'address', 200),
    description: txt(formData, 'description', 2000),
    is_homestead: formData.get('is_homestead') === 'on',
    contractor_email: email,
    contractor_name: txt(formData, 'contractor_name', 120),
    message: txt(formData, 'message', 500),
  };
  const { data: inv, error } = await db.from('project_invites').insert(row).select('id').single();
  if (error || !inv) back('/invites/new', 'Could not create the invite. Check that the database step was run.');

  await sendInvite(row, homeownerName || user.email || 'A homeowner');
  revalidatePath('/projects');
  redirect(`/invites/${inv.id}?sent=1`);
}

export async function resendInvite(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const { user, invite, side } = await loadInvite(id);
  if (!invite || side !== 'homeowner') redirect('/projects');
  const path = `/invites/${invite.id}`;
  if (invite.status !== 'pending' || isExpired(invite)) back(path, 'This invite is no longer open.');
  if (invite.send_count >= MAX_SENDS) back(path, 'This invite was already sent the maximum number of times.');
  if (Date.now() - new Date(invite.last_sent_at).getTime() < 3600_000) back(path, 'You can resend an hour after the last one.');
  await supabaseAdmin().from('project_invites').update({ send_count: invite.send_count + 1, last_sent_at: new Date().toISOString() }).eq('id', invite.id).eq('status', 'pending');
  await sendInvite(invite, invite.homeowner_name || user.email || 'A homeowner');
  redirect(`${path}?resent=1`);
}

export async function cancelInvite(formData: FormData) {
  const { invite, side } = await loadInvite(String(formData.get('id') ?? ''));
  if (!invite || side !== 'homeowner') redirect('/projects');
  await supabaseAdmin().from('project_invites').update({ status: 'cancelled', responded_at: new Date().toISOString() }).eq('id', invite.id).eq('status', 'pending');
  revalidatePath('/projects');
  redirect('/projects');
}

export async function declineInvite(formData: FormData) {
  const { invite, side } = await loadInvite(String(formData.get('id') ?? ''));
  if (!invite || side !== 'contractor') redirect('/projects');
  const { data: done } = await supabaseAdmin().from('project_invites').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', invite.id).eq('status', 'pending').select('id');
  if ((done ?? []).length) {
    await notifyUsers({ userIds: [invite.homeowner_id], projectId: null, kind: 'invite', title: `Your invite for ${invite.project_name} was declined`, body: 'The contractor chose not to take this project. You can invite someone else.' });
  }
  revalidatePath('/projects');
  redirect('/projects');
}

export async function acceptInvite(formData: FormData) {
  const { user, invite, side } = await loadInvite(String(formData.get('id') ?? ''));
  if (!invite || side !== 'contractor') redirect('/projects');
  const path = `/invites/${invite.id}`;
  if (invite.status !== 'pending' || isExpired(invite)) back(path, 'This invite is no longer open.');
  const db = supabaseAdmin();

  // A contractor needs a company. Use theirs, or create one from the name they typed.
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  let companyId = (mem ?? [])[0]?.company_id as string | undefined;
  let companyName = '';
  if (!companyId) {
    companyName = txt(formData, 'company_name', 120);
    if (!companyName) back(path, 'Enter your company name to accept.');
  }

  // Claim the invite first, so two taps or two tabs cannot create two projects.
  const { data: claimed } = await db.from('project_invites').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', invite.id).eq('status', 'pending').select('id');
  if (!(claimed ?? []).length) back(path, 'This invite was already answered.');
  const undo = async () => {
    await db.from('project_invites').update({ status: 'pending', responded_at: null }).eq('id', invite.id);
  };

  if (!companyId) {
    const { data: co } = await db.from('companies').insert({ name: companyName, created_by: user.id }).select('id').single();
    if (!co) {
      await undo();
      back(path, 'Could not create your company. Try again.');
    }
    companyId = co.id as string;
    await db.from('company_members').insert({ company_id: companyId, user_id: user.id, role: 'owner' });
  }
  const { data: co2 } = await db.from('companies').select('name').eq('id', companyId).maybeSingle();
  const coName = (co2?.name as string | undefined) ?? 'Your contractor';

  const { data: hp } = await db.from('profiles').select('email').eq('id', invite.homeowner_id).maybeSingle();
  const homeownerEmail = ((hp?.email as string | undefined) ?? '').toLowerCase();
  const { data: project, error } = await db.from('projects').insert({
    company_id: companyId,
    name: invite.project_name,
    address: invite.address,
    homeowner_name: invite.homeowner_name,
    homeowner_email: homeownerEmail,
    is_homestead: invite.is_homestead,
    created_by: user.id,
  }).select('id').single();
  if (error || !project) {
    await undo();
    back(path, 'Could not open the project. Try again.');
  }

  await db.from('project_members').insert([
    { project_id: project.id, user_id: user.id, role: 'contractor' },
    { project_id: project.id, user_id: invite.homeowner_id, role: 'homeowner' },
  ]);
  if (invite.description) {
    await db.from('messages').insert({ project_id: project.id, sender_id: invite.homeowner_id, sender_role: 'homeowner', tag: null, body: `What I would like done:\n\n${invite.description}`.slice(0, 4000) });
  }
  await db.from('project_invites').update({ project_id: project.id }).eq('id', invite.id);
  await notifyUsers({
    userIds: [invite.homeowner_id],
    projectId: project.id,
    kind: 'invite',
    title: `${coName} accepted your invite for ${invite.project_name}`,
    body: 'Your project is open. Next, the contractor writes up the scope and price in the Agreement tab for you to approve.',
  });
  revalidatePath('/projects');
  redirect(`/projects/${project.id}/overview`);
}
