'use server';

import { revalidatePath } from 'next/cache';
import { audit, isTeamAdmin, requireAdmin } from '@/lib/admin';
import { notifyUsers } from '@/lib/notify';
import { supabaseAdmin } from '@/lib/supabase/server';
import { miles, zipCoords } from '@/lib/matching';

export type Result = { ok: true; message: string } | { ok: false; error: string };
const MAX_RECIPIENTS = 200;

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function banUser(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'user_id');
  const reason = str(f, 'reason').slice(0, 500);
  if (!id) return { ok: false, error: 'No user selected.' };
  if (id === me.id) return { ok: false, error: 'You cannot suspend yourself.' };
  if (!reason) return { ok: false, error: 'Add a short reason. It goes in the audit log.' };

  const { data: prof } = await db.from('profiles').select('email').eq('id', id).maybeSingle();
  if (!prof) return { ok: false, error: 'User not found.' };
  if (await isTeamAdmin(prof.email)) return { ok: false, error: 'Admin accounts cannot be suspended here.' };

  // Block new sign-ins and token refreshes at Supabase, and flag the profile so existing sessions are stopped by the app.
  const { error } = await db.auth.admin.updateUserById(id, { ban_duration: '876000h' });
  if (error) return { ok: false, error: `Could not suspend: ${error.message}` };
  await db.from('profiles').update({ banned_at: new Date().toISOString(), ban_reason: reason }).eq('id', id);
  await audit(me, 'ban', { type: 'user', id }, { email: prof.email, reason });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: `${prof.email} is suspended.` };
}

export async function unbanUser(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin();
  const id = str(f, 'user_id');
  if (!id) return { ok: false, error: 'No user selected.' };
  const { data: prof } = await db.from('profiles').select('email').eq('id', id).maybeSingle();
  if (!prof) return { ok: false, error: 'User not found.' };
  const { error } = await db.auth.admin.updateUserById(id, { ban_duration: 'none' });
  if (error) return { ok: false, error: `Could not restore: ${error.message}` };
  await db.from('profiles').update({ banned_at: null, ban_reason: '' }).eq('id', id);
  await audit(me, 'unban', { type: 'user', id }, { email: prof.email });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: `${prof.email} is restored.` };
}

/** Everyone attached to a project: homeowner(s), direct members and company staff. */
async function projectUserIds(projectId: string): Promise<string[]> {
  const db = supabaseAdmin();
  const { data: p } = await db.from('projects').select('company_id').eq('id', projectId).maybeSingle();
  if (!p) return [];
  const [{ data: pm }, { data: cm }] = await Promise.all([
    db.from('project_members').select('user_id').eq('project_id', projectId),
    db.from('company_members').select('user_id').eq('company_id', p.company_id),
  ]);
  return Array.from(new Set([...(pm ?? []), ...(cm ?? [])].map((r) => r.user_id as string)));
}

async function audienceIds(audience: string, target: string): Promise<string[]> {
  const db = supabaseAdmin();
  const ids = async (q: PromiseLike<{ data: { [k: string]: unknown }[] | null }>, col: string) =>
    ((await q).data ?? []).map((r) => r[col] as string);

  if (audience === 'user') return target ? [target] : [];
  if (audience === 'project') return target ? projectUserIds(target) : [];
  if (audience === 'everyone') return ids(db.from('profiles').select('id').is('banned_at', null), 'id');

  const contractors = new Set([
    ...(await ids(db.from('company_members').select('user_id'), 'user_id')),
    ...(await ids(db.from('project_members').select('user_id').eq('role', 'contractor'), 'user_id')),
  ]);
  if (audience === 'contractors') return Array.from(contractors);
  if (audience === 'homeowners') {
    const h = await ids(db.from('project_members').select('user_id').eq('role', 'homeowner'), 'user_id');
    return Array.from(new Set(h)).filter((id) => !contractors.has(id));
  }
  return [];
}

async function send(ids: string[], title: string, body: string, projectId: string | null, force: boolean) {
  // People who turned off "tips and local news" get the in-app alert only, unless this is a forced account or safety notice.
  // Until the 020 column exists, nobody counts as opted out.
  let off = new Set<string>();
  if (!force) {
    const { data: offs } = await supabaseAdmin().from('profiles').select('id,marketing_email').in('id', ids);
    off = new Set(((offs ?? []) as any[]).filter((p) => p.marketing_email === false).map((p) => p.id as string));
  }
  const loud = ids.filter((id) => !off.has(id));
  const quiet = ids.filter((id) => off.has(id));
  // Small batches keep us under email provider rate limits and the function time limit.
  for (let i = 0; i < loud.length; i += 10) {
    await notifyUsers({ userIds: loud.slice(i, i + 10), projectId, kind: 'admin', title, body, force });
  }
  for (let i = 0; i < quiet.length; i += 10) {
    await notifyUsers({ userIds: quiet.slice(i, i + 10), projectId, kind: 'admin', title, body, inAppOnly: true });
  }
}

export async function sendBroadcast(_: Result | null, f: FormData): Promise<Result> {
  const { user: me } = await requireAdmin();
  const audience = str(f, 'audience');
  const target = str(f, 'target');
  const title = str(f, 'title').slice(0, 120);
  const body = str(f, 'body').slice(0, 2000);
  const force = f.get('force') === 'on';
  if (!['everyone', 'contractors', 'homeowners', 'project', 'user'].includes(audience)) return { ok: false, error: 'Pick who gets this.' };
  if ((audience === 'project' || audience === 'user') && !target) return { ok: false, error: 'Choose the project or user.' };
  if (!title || !body) return { ok: false, error: 'Add a subject and a message.' };

  const ids = (await audienceIds(audience, target)).filter((id) => id !== me.id);
  if (!ids.length) return { ok: false, error: 'No one matches that audience.' };
  if (ids.length > MAX_RECIPIENTS)
    return { ok: false, error: `That is ${ids.length} people. The limit is ${MAX_RECIPIENTS} per send. Narrow the audience.` };

  await send(ids, title, body, audience === 'project' ? target : null, force);
  await audit(me, 'broadcast', { type: audience, id: target }, { title, recipients: ids.length, force });
  revalidatePath('/admin/audit');
  return { ok: true, message: `Sent to ${ids.length} ${ids.length === 1 ? 'person' : 'people'}.` };
}

/** Review moderation. Hide for rule violations (abuse, personal details, off-topic, fake), never for a low rating alone. */
export async function hideReview(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin('reviews');
  const id = str(f, 'review_id');
  const reason = str(f, 'reason').slice(0, 500);
  if (!id) return { ok: false, error: 'No review selected.' };
  if (!reason) return { ok: false, error: 'Write the reason. It goes in the audit log.' };
  const { error } = await db.from('reviews').update({ hidden_at: new Date().toISOString(), hidden_reason: reason }).eq('id', id);
  if (error) return { ok: false, error: `Could not hide: ${error.message}` };
  await audit(me, 'hide_review', { type: 'review', id }, { reason });
  revalidatePath('/admin/reviews');
  return { ok: true, message: 'Review hidden.' };
}

export async function restoreReview(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin('reviews');
  const id = str(f, 'review_id');
  const dismiss = f.get('dismiss') === '1';
  const patch = dismiss
    ? { reported_at: null, reported_by: null, report_reason: '' }
    : { hidden_at: null, hidden_reason: '', reported_at: null, reported_by: null, report_reason: '' };
  const { error } = await db.from('reviews').update(patch).eq('id', id);
  if (error) return { ok: false, error: `Could not update: ${error.message}` };
  await audit(me, dismiss ? 'dismiss_report' : 'restore_review', { type: 'review', id });
  revalidatePath('/admin/reviews');
  return { ok: true, message: dismiss ? 'Report dismissed. The review stays visible.' : 'Review restored.' };
}

/** Approve or reject an insurance certificate. The contractor is told either way. */
export async function reviewInsurance(_: Result | null, f: FormData): Promise<Result> {
  const { user: me, db } = await requireAdmin('verification');
  const id = str(f, 'id');
  const decision = str(f, 'decision');
  const note = str(f, 'note').slice(0, 300);
  if (!id || (decision !== 'approved' && decision !== 'rejected')) return { ok: false, error: 'Nothing to review.' };
  if (decision === 'rejected' && !note) return { ok: false, error: 'Tell the contractor why. They will see this note.' };
  const { data: ins } = await db.from('company_insurance').select('id,company_id,kind,expires_on,status').eq('id', id).maybeSingle();
  if (!ins) return { ok: false, error: 'Certificate not found.' };
  if (decision === 'approved' && (ins.expires_on as string) < new Date().toISOString().slice(0, 10)) return { ok: false, error: 'That policy has already expired. Reject it.' };
  const { error } = await db
    .from('company_insurance')
    .update({ status: decision, review_note: decision === 'rejected' ? note : '', reviewed_by: me.id, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: `Could not save: ${error.message}` };
  await audit(me, decision === 'approved' ? 'insurance_approve' : 'insurance_reject', { type: 'company', id: ins.company_id as string }, { kind: ins.kind, note });
  const { data: owners } = await db.from('company_members').select('user_id').eq('company_id', ins.company_id as string).eq('role', 'owner');
  await notifyUsers({
    userIds: (owners ?? []).map((o) => o.user_id as string),
    projectId: null,
    kind: 'admin',
    title: decision === 'approved' ? 'Your insurance was verified' : 'Your insurance certificate needs another look',
    body: decision === 'approved' ? 'The Insurance verified badge now shows on your public profile.' : `Reason: ${note}. Open Settings, Business profile to upload a new one.`,
    force: true,
  });
  revalidatePath('/admin/verification');
  return { ok: true, message: decision === 'approved' ? 'Approved. The badge is live.' : 'Rejected. The contractor was told why.' };
}

/** Admin closes a marketplace listing (rule violation). Waiting bidders are told it closed. */
export async function adminCloseListing(formData: FormData) {
  const { user: me, db } = await requireAdmin('listings');
  const id = String(formData.get('listing_id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 300) || 'Closed by admin';
  const { data: l } = await db.from('marketplace_listings').update({ status: 'closed' }).eq('id', id).eq('status', 'open').select('id,homeowner_id,job_type');
  if ((l ?? []).length) {
    const { data: bids } = await db.from('marketplace_bids').update({ status: 'not_selected', updated_at: new Date().toISOString() }).eq('listing_id', id).eq('status', 'waiting').select('bidder_id');
    await audit(me, 'close_listing', { type: 'listing', id }, { reason });
    await notifyUsers({ userIds: [(l ?? [])[0].homeowner_id as string], projectId: null, kind: 'admin', path: '/marketplace', title: 'Your marketplace project was closed', body: `Jobfile closed this project. Reason: ${reason}`, force: true });
    await notifyUsers({ userIds: Array.from(new Set((bids ?? []).map((b) => b.bidder_id as string))), projectId: null, kind: 'bid', path: '/marketplace/bids', title: 'A project you bid on was closed', body: 'It is no longer taking bids.' });
  }
  revalidatePath('/admin/marketplace');
  revalidatePath('/marketplace');
}


export type AreaPerson = { id: string; label: string; kind: 'contractor' | 'homeowner'; miles: number; posted?: boolean; tipsOff?: boolean };
export type AreaPreview = { ok: true; people: AreaPerson[]; capped: boolean; noZip: number } | { ok: false; error: string };

/** Contractors by business ZIP, homeowners by their own ZIP or the ZIP of a project they posted. Suspended accounts and the admin are left out. */
async function peopleInArea(zip: string, radius: number, who: string, meId: string): Promise<AreaPreview> {
  if (!/^\d{5}$/.test(zip)) return { ok: false, error: 'Enter a 5 digit ZIP code.' };
  if (!(radius >= 1 && radius <= 100)) return { ok: false, error: 'Radius must be 1 to 100 miles.' };
  if (!['contractors', 'homeowners', 'both'].includes(who)) return { ok: false, error: 'Pick who to message.' };
  const db = supabaseAdmin();
  const found: { id: string; zip: string; label: string; kind: 'contractor' | 'homeowner' }[] = [];

  if (who !== 'homeowners') {
    const { data: cos } = await db.from('companies').select('id,name,business_zip').not('business_zip', 'is', null).limit(2000);
    const names = new Map(((cos ?? []) as any[]).map((c) => [c.id as string, c]));
    if (names.size) {
      const { data: mem } = await db.from('company_members').select('company_id,user_id').in('company_id', Array.from(names.keys()));
      ((mem ?? []) as any[]).forEach((m) => {
        const c: any = names.get(m.company_id);
        if (c) found.push({ id: m.user_id, zip: c.business_zip, label: c.name || 'Contractor', kind: 'contractor' });
      });
    }
  }
  const posters = new Set<string>();
  let noZip = 0;
  if (who !== 'contractors') {
    const { data: ls } = await db.from('marketplace_listings').select('homeowner_id,zip').limit(5000);
    ((ls ?? []) as any[]).forEach((l) => { posters.add(l.homeowner_id as string); found.push({ id: l.homeowner_id, zip: l.zip, label: '', kind: 'homeowner' }); });
    // Homeowners who gave a ZIP on their profile (020). Contractors are not counted as homeowners.
    const { data: mems } = await db.from('company_members').select('user_id').limit(5000);
    const staff = new Set(((mems ?? []) as any[]).map((m) => m.user_id as string));
    const { data: all } = await db.from('profiles').select('*').limit(5000);
    ((all ?? []) as any[]).forEach((p) => {
      if (staff.has(p.id) || p.banned_at) return;
      if (p.zip) found.push({ id: p.id, zip: p.zip, label: '', kind: 'homeowner' });
      else if (!posters.has(p.id) && 'zip' in p && p.id !== meId) noZip += 1;
    });
  }
  if (!found.length) return { ok: true, people: [], capped: false, noZip };

  const coords = await zipCoords([zip, ...found.map((f) => f.zip)]);
  const center = coords.get(zip);
  if (!center) return { ok: false, error: 'That ZIP code was not found.' };

  const best = new Map<string, AreaPerson & { zip: string }>();
  for (const f of found) {
    const at = coords.get(f.zip);
    if (!at || f.id === meId) continue;
    const d = Math.round(miles(center, at));
    if (d > radius) continue;
    const prev = best.get(f.id);
    if (!prev || d < prev.miles) best.set(f.id, { id: f.id, label: f.label, kind: f.kind, miles: d, zip: f.zip });
  }
  if (!best.size) return { ok: true, people: [], capped: false, noZip };

  const { data: profs } = await db.from('profiles').select('*').in('id', Array.from(best.keys()));
  const people: AreaPerson[] = [];
  ((profs ?? []) as any[]).forEach((p) => {
    if (p.banned_at) return;
    const b = best.get(p.id)!;
    people.push({ id: b.id, kind: b.kind, miles: b.miles, label: b.label ? `${b.label} (${p.email})` : p.email, posted: posters.has(b.id), tipsOff: p.marketing_email === false });
  });
  people.sort((a, b) => a.miles - b.miles);
  return { ok: true, people, capped: people.length > MAX_RECIPIENTS, noZip };
}

export async function previewArea(input: { zip: string; radius: number; who: string }): Promise<AreaPreview> {
  const { user: me } = await requireAdmin();
  return peopleInArea(String(input.zip ?? '').trim(), Number(input.radius), String(input.who ?? ''), me.id);
}

export async function sendArea(_: Result | null, f: FormData): Promise<Result> {
  const { user: me } = await requireAdmin();
  const zip = str(f, 'zip');
  const radius = Number(str(f, 'radius'));
  const who = str(f, 'who');
  const title = str(f, 'title').slice(0, 120);
  const body = str(f, 'body').slice(0, 2000);
  const force = f.get('force') === 'on';
  let skip: string[] = [];
  try { skip = JSON.parse(str(f, 'skip') || '[]'); } catch { skip = []; }
  if (!title || !body) return { ok: false, error: 'Add a subject and a message.' };

  const r = await peopleInArea(zip, radius, who, me.id);
  if (!r.ok) return { ok: false, error: r.error };
  const skipSet = new Set(Array.isArray(skip) ? skip.map(String) : []);
  const ids = r.people.map((p) => p.id).filter((id) => !skipSet.has(id));
  if (!ids.length) return { ok: false, error: 'No one to send to.' };
  if (ids.length > MAX_RECIPIENTS) return { ok: false, error: `That is ${ids.length} people. The limit is ${MAX_RECIPIENTS} per send. Use a smaller radius or skip some people.` };

  await send(ids, title, body, null, force);
  await audit(me, 'broadcast_area', { type: 'area', id: zip }, { title, recipients: ids.length, radius, who, force });
  revalidatePath('/admin/audit');
  return { ok: true, message: `Sent to ${ids.length} ${ids.length === 1 ? 'person' : 'people'}. Saved in the audit log.` };
}
