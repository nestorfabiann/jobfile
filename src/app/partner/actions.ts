'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { APP_URL, notifyUsers, sendEmail } from '@/lib/notify';
import { dollars, parseDollars } from '@/lib/money';
import { companyOf, memberIds } from '@/lib/team';
import { EMAIL_RE, partnerFor, withinPartnerRange, type ProjectPartner } from '@/lib/partners';

const txt = (f: FormData, k: string, n: number) => String(f.get(k) ?? '').trim().slice(0, n);
const MAX_PARTNERS = 5;
function go(path: string, key: 'error' | 'ok', msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
}
const dateOrNull = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

/** The lead's company for a project, when the signed-in person is on it. */
async function leadAccess(userId: string, projectId: string) {
  const db = supabaseAdmin();
  const { data: project } = await db.from('projects').select('id,name,company_id').eq('id', projectId).maybeSingle<any>();
  if (!project) return null;
  const me = await companyOf(userId);
  if (!me || me.id !== project.company_id) return null;
  return { project, me, db };
}

async function homeownerIds(projectId: string): Promise<string[]> {
  const { data } = await supabaseAdmin().from('project_members').select('user_id').eq('project_id', projectId).eq('role', 'homeowner');
  return (data ?? []).map((m: any) => m.user_id as string);
}
async function partnerUserIds(p: ProjectPartner): Promise<string[]> {
  if (p.partner_company_id) return memberIds(p.partner_company_id);
  const { data } = await supabaseAdmin().from('profiles').select('id').eq('email', p.partner_email).maybeSingle<any>();
  return data?.id ? [data.id as string] : [];
}

export async function invitePartner(formData: FormData) {
  const { user } = await requireUser();
  const projectId = txt(formData, 'project_id', 60);
  const path = `/projects/${projectId}/partners/new`;
  const a = await leadAccess(user.id, projectId);
  if (!a) redirect('/projects');
  const { db, project, me } = a;

  const name = txt(formData, 'name', 120);
  const email = txt(formData, 'email', 200).toLowerCase();
  const scope = txt(formData, 'scope', 400);
  const price = parseDollars(txt(formData, 'price', 20));
  const start = dateOrNull(txt(formData, 'start_date', 10));
  const end = dateOrNull(txt(formData, 'end_date', 10));
  const keep = `${path}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&scope=${encodeURIComponent(scope)}`;
  if (!name) go(keep, 'error', 'Enter the partner’s company name.');
  if (!EMAIL_RE.test(email)) go(keep, 'error', 'Enter the partner’s email address.');
  if (!scope) go(keep, 'error', 'Describe their part of the job.');
  if (price < 100_00 || price > 10_000_000_00) go(keep, 'error', 'Enter their price in dollars (for example 1400).');
  if (start && end && end < start) go(keep, 'error', 'The end date is before the start date.');

  const { data: existing } = await db.from('project_partners').select('id,partner_email,status').eq('project_id', projectId).in('status', ['invited', 'countered', 'accepted']);
  const live = (existing ?? []) as any[];
  if (live.length >= MAX_PARTNERS) go(keep, 'error', `A project can have up to ${MAX_PARTNERS} partners.`);
  if (live.some((x) => x.partner_email === email)) go(keep, 'error', 'That person is already on this project.');

  // Match an existing Jobfile company by the email they signed up with.
  const { data: prof } = await db.from('profiles').select('id').eq('email', email).maybeSingle<any>();
  const theirs = prof?.id ? await companyOf(prof.id as string) : null;
  if (theirs && theirs.id === me.id) go(keep, 'error', 'That is your own company.');
  if (theirs) {
    const [{ data: a1 }, { data: a2 }] = await Promise.all([
      db.from('companies').select('business_zip').eq('id', me.id).maybeSingle<any>(),
      db.from('companies').select('business_zip').eq('id', theirs.id).maybeSingle<any>(),
    ]);
    const ok = await withinPartnerRange(a1?.business_zip, a2?.business_zip);
    if (ok === false) go(keep, 'error', 'Partners need to be local, within 50 miles of your business.');
  }

  const { data: row, error } = await db.from('project_partners').insert({
    project_id: projectId, lead_company_id: me.id, invited_by: user.id, partner_company_id: theirs?.id ?? null,
    partner_name: name, partner_email: email, scope, price_cents: price, start_date: start, end_date: end,
  }).select('id').single<any>();
  if (error || !row) go(keep, 'error', 'Could not add the partner. Check that the database step was run.');

  const title = `${me.name} invited you to work on a job`;
  const body = `${scope}\n\nYour price: ${dollars(price)}. You only see your part of the job. The homeowner’s contact details and the total stay private.`;
  if (prof?.id) {
    await notifyUsers({ userIds: theirs ? await memberIds(theirs.id) : [prof.id as string], projectId: null, kind: 'bid', path: `/partner/${row.id}`, title, body, cta: 'Review the invite' });
  } else {
    await sendEmail({ to: email, subject: title, text: `${body}\n\nJobfile is free for contractors. Sign in with this email address (${email}) to review the invite.`, link: `${APP_URL()}/login?email=${encodeURIComponent(email)}`, cta: 'Review the invite' });
  }
  revalidatePath(`/projects/${projectId}/overview`);
  redirect(`/projects/${projectId}/overview?partner=sent`);
}

export async function answerPartner(formData: FormData) {
  const { user } = await requireUser();
  const id = txt(formData, 'id', 60);
  const path = `/partner/${id}`;
  const me = await companyOf(user.id);
  const p = await partnerFor(user.id, me?.id ?? null, id);
  if (!p) redirect('/collaborate');
  const answer = txt(formData, 'answer', 10);
  if (!['accept', 'counter', 'decline'].includes(answer)) redirect(path);
  if (!['invited', 'countered'].includes(p.status)) redirect(path);
  const db = supabaseAdmin();
  const { data: proj } = await db.from('projects').select('name,company_id').eq('id', p.project_id).maybeSingle<any>();
  const leadUsers = await memberIds(p.lead_company_id);
  const who = me?.name ?? p.partner_name;

  if (answer === 'decline') {
    await db.from('project_partners').update({ status: 'declined', partner_company_id: me?.id ?? p.partner_company_id, updated_at: new Date().toISOString() }).eq('id', p.id);
    await notifyUsers({ userIds: leadUsers, projectId: p.project_id, kind: 'bid', path: `/projects/${p.project_id}/partners/${p.id}`, title: `${who} declined`, body: `They will not work on ${proj?.name ?? 'the job'}.` });
    revalidatePath('/collaborate');
    redirect('/collaborate?ok=Invite%20declined.');
  }
  if (!me) go(path, 'error', 'Set up your company in Business profile first, then come back to answer.');

  if (answer === 'counter') {
    const c = parseDollars(txt(formData, 'price', 20));
    if (c < 100_00 || c > 10_000_000_00) go(path, 'error', 'Enter your price in dollars (for example 1500).');
    await db.from('project_partners').update({ status: 'countered', counter_cents: c, partner_company_id: me.id, updated_at: new Date().toISOString() }).eq('id', p.id);
    await notifyUsers({ userIds: leadUsers, projectId: p.project_id, kind: 'bid', path: `/projects/${p.project_id}/partners/${p.id}`, title: `${who} proposed ${dollars(c)}`, body: `For their part of ${proj?.name ?? 'the job'}. Open the project to accept or change it.` });
    revalidatePath(path);
    go(path, 'ok', 'Your price was sent to the lead.');
  }

  // Accept: the partner must be local to the lead.
  const [{ data: a1 }, { data: a2 }] = await Promise.all([
    db.from('companies').select('business_zip').eq('id', p.lead_company_id).maybeSingle<any>(),
    db.from('companies').select('business_zip').eq('id', me.id).maybeSingle<any>(),
  ]);
  if ((await withinPartnerRange(a1?.business_zip, a2?.business_zip)) === false) go(path, 'error', 'This job is more than 50 miles from your business, so you can’t partner on it.');
  const { error } = await db.from('project_partners').update({ status: 'accepted', partner_company_id: me.id, counter_cents: null, updated_at: new Date().toISOString() }).eq('id', p.id).in('status', ['invited', 'countered']);
  if (error) go(path, 'error', 'Could not accept. Try again.');
  await notifyUsers({ userIds: leadUsers, projectId: p.project_id, kind: 'bid', path: `/projects/${p.project_id}/partners/${p.id}`, title: `${who} accepted`, body: `They are on ${proj?.name ?? 'the job'} for ${dollars(p.price_cents)}.` });
  await notifyUsers({ userIds: await homeownerIds(p.project_id), projectId: p.project_id, kind: 'bid', path: `/projects/${p.project_id}/overview`, title: `A partner joined ${proj?.name ?? 'your project'}`, body: `${who} will work on part of your job, brought in by your contractor. Your contractor stays your contact. You can see and remove partners on the project page.` });
  revalidatePath(path);
  go(path, 'ok', 'You are on the job.');
}

/** The lead accepts the price a partner proposed. */
export async function acceptPartnerPrice(formData: FormData) {
  const { user } = await requireUser();
  const id = txt(formData, 'id', 60);
  const db = supabaseAdmin();
  const { data: p } = await db.from('project_partners').select('*').eq('id', id).maybeSingle<ProjectPartner>();
  if (!p) redirect('/projects');
  const path = `/projects/${p.project_id}/partners/${p.id}`;
  const a = await leadAccess(user.id, p.project_id);
  if (!a) redirect('/projects');
  if (p.status !== 'countered' || !p.counter_cents) redirect(path);
  const { data: proj } = await db.from('projects').select('name').eq('id', p.project_id).maybeSingle<any>();
  await db.from('project_partners').update({ status: 'accepted', price_cents: p.counter_cents, counter_cents: null, updated_at: new Date().toISOString() }).eq('id', p.id);
  await notifyUsers({ userIds: await partnerUserIds(p), projectId: null, kind: 'bid', path: `/partner/${p.id}`, title: `${a.me.name} accepted your price`, body: `You are on ${proj?.name ?? 'the job'} for ${dollars(p.counter_cents)}.` });
  await notifyUsers({ userIds: await homeownerIds(p.project_id), projectId: p.project_id, kind: 'bid', path: `/projects/${p.project_id}/overview`, title: `A partner joined ${proj?.name ?? 'your project'}`, body: `${p.partner_name} will work on part of your job, brought in by your contractor.` });
  revalidatePath(path);
  go(path, 'ok', 'Price accepted. They are on the job.');
}

/** Lead or homeowner takes a partner off the project. */
export async function removePartner(formData: FormData) {
  const { user } = await requireUser();
  const id = txt(formData, 'id', 60);
  const db = supabaseAdmin();
  const { data: p } = await db.from('project_partners').select('*').eq('id', id).maybeSingle<ProjectPartner>();
  if (!p) redirect('/projects');
  const lead = await leadAccess(user.id, p.project_id);
  const isHomeowner = !lead && (await homeownerIds(p.project_id)).includes(user.id);
  if (!lead && !isHomeowner) redirect('/projects');
  if (!['invited', 'countered', 'accepted'].includes(p.status)) redirect(`/projects/${p.project_id}/overview`);
  const { data: proj } = await db.from('projects').select('name').eq('id', p.project_id).maybeSingle<any>();
  await db.from('project_partners').update({ status: 'removed', removed_by: lead ? 'lead' : 'homeowner', updated_at: new Date().toISOString() }).eq('id', p.id);
  const pname = proj?.name ?? 'the job';
  await notifyUsers({ userIds: await partnerUserIds(p), projectId: null, kind: 'bid', path: '/collaborate', title: `You were taken off ${pname}`, body: lead ? `${lead.me.name} removed you from the job.` : 'The homeowner asked for you to be taken off the job. Talk to the lead if you have questions.' });
  if (isHomeowner) {
    await notifyUsers({ userIds: await memberIds(p.lead_company_id), projectId: p.project_id, kind: 'bid', path: `/projects/${p.project_id}/overview`, title: `The homeowner removed ${p.partner_name}`, body: `${pname}: the homeowner took ${p.partner_name} off the job.` });
  } else if (p.status === 'accepted') {
    await notifyUsers({ userIds: await homeownerIds(p.project_id), projectId: p.project_id, kind: 'bid', path: `/projects/${p.project_id}/overview`, title: `${p.partner_name} is no longer on your project`, body: 'Your contractor removed this partner.' });
  }
  revalidatePath(`/projects/${p.project_id}/overview`);
  redirect(`/projects/${p.project_id}/overview`);
}

/** Message between the lead and the partner. Never shown to the homeowner. */
export async function sendPartnerMessage(formData: FormData) {
  const { user } = await requireUser();
  const id = txt(formData, 'id', 60);
  const body = txt(formData, 'body', 2000);
  const db = supabaseAdmin();
  const { data: p } = await db.from('project_partners').select('*').eq('id', id).maybeSingle<ProjectPartner>();
  if (!p) redirect('/projects');
  const me = await companyOf(user.id);
  let side: 'lead' | 'partner' | null = null;
  if (me && me.id === p.lead_company_id) side = 'lead';
  else if (await partnerFor(user.id, me?.id ?? null, id)) side = 'partner';
  if (!side) redirect('/projects');
  const path = side === 'lead' ? `/projects/${p.project_id}/partners/${p.id}` : `/partner/${p.id}`;
  if (!body) go(path, 'error', 'Write a message first.');
  if (!['invited', 'countered', 'accepted'].includes(p.status)) go(path, 'error', 'This partner is no longer on the job.');
  await db.from('partner_messages').insert({ partner_id: p.id, sender_id: user.id, sender_side: side, body });
  const to = side === 'lead' ? await partnerUserIds(p) : await memberIds(p.lead_company_id);
  const { data: proj } = await db.from('projects').select('name').eq('id', p.project_id).maybeSingle<any>();
  await notifyUsers({ userIds: to.filter((u) => u !== user.id), projectId: null, kind: 'message', path: side === 'lead' ? `/partner/${p.id}` : `/projects/${p.project_id}/partners/${p.id}`, title: `New message about ${proj?.name ?? 'a job'}`, body: 'Open Jobfile to read it.', throttle: true });
  revalidatePath(path);
  redirect(`${path}#messages`);
}

/** The lead records what they paid the partner. Records only; Jobfile does not move money. */
export async function recordPartnerPayout(formData: FormData) {
  const { user } = await requireUser();
  const id = txt(formData, 'id', 60);
  const db = supabaseAdmin();
  const { data: p } = await db.from('project_partners').select('*').eq('id', id).maybeSingle<ProjectPartner>();
  if (!p) redirect('/projects');
  const path = `/projects/${p.project_id}/partners/${p.id}`;
  if (!(await leadAccess(user.id, p.project_id))) redirect('/projects');
  const amt = parseDollars(txt(formData, 'amount', 20));
  if (amt < 1_00 || amt > p.price_cents - p.paid_cents) go(path, 'error', `Enter an amount up to ${dollars(p.price_cents - p.paid_cents)}.`);
  await db.from('project_partners').update({ paid_cents: p.paid_cents + amt, updated_at: new Date().toISOString() }).eq('id', p.id);
  await notifyUsers({ userIds: await partnerUserIds(p), projectId: null, kind: 'payment', path: `/partner/${p.id}`, title: `${dollars(amt)} recorded as paid to you`, body: 'The lead marked this payment on the job. Jobfile only keeps the record.' });
  revalidatePath(path);
  go(path, 'ok', 'Payment recorded.');
}
