'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyUsers } from '@/lib/notify';
import { parseDollars } from '@/lib/money';
import { hasContactInfo } from '@/lib/contactInfo';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { COMMUNITY_BUCKET, HOLD_AFTER_REPORTS, MAX_COMMENTS_PER_DAY, MAX_IDEAS_PER_DAY, MAX_OPEN_SHOWCASES, type Post } from '@/lib/community';

const txt = (f: FormData, k: string, n: number) => String(f.get(k) ?? '').trim().slice(0, n);
function go(path: string, key: 'error' | 'ok', msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
}
/** Only paths inside Community, so a form cannot send someone elsewhere. */
const safeBack = (v: unknown, fallback: string) => {
  const s = String(v ?? '');
  return /^\/community(\/[0-9a-f-]{36})?(\/mine)?$/.test(s) ? s : fallback;
};
const NO_CONTACT = 'Phone numbers, emails and web links are not allowed here. Take them out and try again.';
type Db = ReturnType<typeof supabaseAdmin>;

/** Which side of a project a person is on: homeowner, contractor (project member or on the company), or null. */
async function sideOf(db: Db, project: { id: string; company_id: string }, userId: string): Promise<'homeowner' | 'contractor' | null> {
  const { data: pm } = await db.from('project_members').select('role').eq('project_id', project.id).eq('user_id', userId).maybeSingle();
  if (pm) return pm.role as 'homeowner' | 'contractor';
  const { data: cm } = await db.from('company_members').select('user_id').eq('company_id', project.company_id).eq('user_id', userId).maybeSingle();
  return cm ? 'contractor' : null;
}

/** Everyone on the other side of a project from the author. */
async function otherSideIds(db: Db, project: { id: string; company_id: string }, authorRole: 'homeowner' | 'contractor'): Promise<string[]> {
  const { data: pms } = await db.from('project_members').select('user_id,role').eq('project_id', project.id);
  const ids = new Set<string>();
  if (authorRole === 'contractor') (pms ?? []).filter((m: any) => m.role === 'homeowner').forEach((m: any) => ids.add(m.user_id as string));
  else {
    (pms ?? []).filter((m: any) => m.role === 'contractor').forEach((m: any) => ids.add(m.user_id as string));
    const { data: cms } = await db.from('company_members').select('user_id').eq('company_id', project.company_id);
    (cms ?? []).forEach((m: any) => ids.add(m.user_id as string));
  }
  return Array.from(ids);
}

async function livePost(db: Db, id: string) {
  const { data } = await db.from('community_posts').select('*').eq('id', id).maybeSingle<Post>();
  return data && data.status === 'live' ? data : null;
}

// ---------- Likes, saves, votes (called from buttons) ----------

export async function toggleLike(postId: string): Promise<{ on: boolean } | { error: string }> {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  if (!(await livePost(db, postId))) return { error: 'This post is not available.' };
  const { data: ex } = await db.from('community_likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
  if (ex) await db.from('community_likes').delete().eq('post_id', postId).eq('user_id', user.id);
  else await db.from('community_likes').insert({ post_id: postId, user_id: user.id });
  return { on: !ex };
}

export async function toggleSave(postId: string): Promise<{ on: boolean } | { error: string }> {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  if (!(await livePost(db, postId))) return { error: 'This post is not available.' };
  const { data: ex } = await db.from('community_saves').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
  if (ex) await db.from('community_saves').delete().eq('post_id', postId).eq('user_id', user.id);
  else await db.from('community_saves').insert({ post_id: postId, user_id: user.id });
  return { on: !ex };
}

export async function voteIdea(postId: string, option: number): Promise<{ counts: number[]; mine: number } | { error: string }> {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const p = await livePost(db, postId);
  if (!p || p.kind !== 'idea' || !Array.isArray(p.poll) || !p.poll.length) return { error: 'This poll is not available.' };
  const opt = Math.floor(Number(option));
  if (!(opt >= 0 && opt < p.poll.length)) return { error: 'Pick one of the options.' };
  const { data: ex } = await db.from('community_votes').select('option').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
  if (!ex) await db.from('community_votes').insert({ post_id: postId, user_id: user.id, option: opt });
  const { data: all } = await db.from('community_votes').select('option').eq('post_id', postId).limit(20000);
  const counts = p.poll.map((_, i) => ((all ?? []) as any[]).filter((v) => v.option === i).length);
  return { counts, mine: ex ? (ex.option as number) : opt };
}

// ---------- Comments and reports ----------

export async function addComment(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const postId = String(formData.get('post_id') ?? '');
  const path = `/community/${postId}`;
  const db = supabaseAdmin();
  const p = await livePost(db, postId);
  if (!p) redirect('/community');
  const body = txt(formData, 'body', 500);
  if (!body) go(path, 'error', 'Write a comment first.');
  if (hasContactInfo(body)) go(path, 'error', NO_CONTACT);
  const { count } = await db.from('community_comments').select('id', { count: 'exact', head: true }).eq('author_id', user.id).gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((count ?? 0) >= MAX_COMMENTS_PER_DAY) go(path, 'error', 'That is a lot of comments for one day. Try again tomorrow.');
  const { data: cm } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  const companyId = ((cm ?? [])[0]?.company_id as string | undefined) ?? null;
  const { error } = await db.from('community_comments').insert({ post_id: postId, author_id: user.id, company_id: companyId, body });
  if (error) go(path, 'error', 'Could not post your comment. Try again.');
  if (p.author_id !== user.id) {
    const title = `${companyId ? 'A pro' : 'Someone'} replied to “${p.title.slice(0, 50)}”`;
    const { count: sent } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', p.author_id).eq('title', title).gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    if ((sent ?? 0) === 0) await notifyUsers({ userIds: [p.author_id], projectId: null, kind: 'community_note', path, title, body: 'Open Community to read it and reply.', cta: 'Read the reply' });
  }
  revalidatePath(path);
  redirect(`${path}?ok=${encodeURIComponent('Comment posted.')}#comments`);
}

export async function deleteComment(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const id = String(formData.get('comment_id') ?? '');
  const db = supabaseAdmin();
  const { data: c } = await db.from('community_comments').select('post_id,author_id').eq('id', id).maybeSingle();
  if (!c) redirect('/community');
  if (c.author_id === user.id) await db.from('community_comments').delete().eq('id', id);
  revalidatePath(`/community/${c.post_id}`);
  redirect(`/community/${c.post_id}#comments`);
}

export async function reportContent(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const type = String(formData.get('target_type') ?? '') === 'comment' ? 'comment' : 'post';
  const id = String(formData.get('target_id') ?? '');
  const back = safeBack(formData.get('back'), '/community');
  if (!/^[0-9a-f-]{36}$/.test(id)) redirect(back);
  const db = supabaseAdmin();
  const exists = type === 'post'
    ? (await db.from('community_posts').select('id').eq('id', id).maybeSingle()).data
    : (await db.from('community_comments').select('id').eq('id', id).maybeSingle()).data;
  if (!exists) redirect(back);
  await db.from('community_reports').insert({ target_type: type, target_id: id, reporter_id: user.id, reason: txt(formData, 'reason', 300) });
  const { count } = await db.from('community_reports').select('id', { count: 'exact', head: true }).eq('target_type', type).eq('target_id', id);
  if ((count ?? 0) >= HOLD_AFTER_REPORTS) {
    if (type === 'post') await db.from('community_posts').update({ status: 'held', updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'live');
    else await db.from('community_comments').update({ status: 'hidden' }).eq('id', id);
  }
  revalidatePath('/community');
  go(back, 'ok', 'Thanks. We will take a look.');
}

// ---------- Ideas ----------

export async function createIdea(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const path = '/community/ask';
  const db = supabaseAdmin();
  const title = txt(formData, 'title', 100);
  const body = txt(formData, 'body', 800);
  if (title.length < 3) go(path, 'error', 'Write your question first.');
  const options = [0, 1, 2, 3].map((i) => txt(formData, `opt${i}`, 40)).filter(Boolean);
  if (options.length === 1) go(path, 'error', 'A poll needs at least two options. Leave them all empty to ask without a poll.');
  if ([title, body, ...options].some(hasContactInfo)) go(path, 'error', NO_CONTACT);
  const trade = txt(formData, 'trade', 60);
  const { count } = await db.from('community_posts').select('id', { count: 'exact', head: true }).eq('author_id', user.id).eq('kind', 'idea').gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((count ?? 0) >= MAX_IDEAS_PER_DAY) go(path, 'error', 'You asked a few questions today already. Try again tomorrow.');
  const id = randomUUID();
  let photoPath: string | null = null;
  const f = formData.get('photo');
  if (f instanceof File && f.size > 0) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 3_000_000) go(path, 'error', 'The photo must be a JPG, PNG or WebP under 3 MB.');
    photoPath = `idea/${id}/photo.jpg`;
    const up = await db.storage.from(COMMUNITY_BUCKET).upload(photoPath, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
    if (up.error) go(path, 'error', 'Could not upload the photo. Try again.');
  }
  const { data: cm } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  const companyId = ((cm ?? [])[0]?.company_id as string | undefined) ?? null;
  const { error } = await db.from('community_posts').insert({
    id, kind: 'idea', author_id: user.id, author_role: companyId ? 'contractor' : 'homeowner', company_id: companyId, title, body,
    trade: JOB_TYPES[trade] ? trade : '', photo_path: photoPath, poll: options.map((label) => ({ label })), status: 'live',
  });
  if (error) go(path, 'error', 'Could not post your question. Check that the database step was run.');
  revalidatePath('/community');
  redirect(`/community/${id}`);
}

// ---------- Showcases ----------

export async function submitShowcase(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const projectId = String(formData.get('project_id') ?? '');
  const back = `/community/share?project=${encodeURIComponent(projectId)}`;
  const db = supabaseAdmin();
  const { data: project } = await db.from('projects').select('id,name,company_id,completed_at').eq('id', projectId).maybeSingle<any>();
  if (!project) go('/community/share', 'error', 'Pick one of your finished projects.');
  const side = await sideOf(db, project, user.id);
  if (!side) go('/community', 'error', 'You are not on that project.');
  if (!project.completed_at) go('/community/share', 'error', 'Only finished projects can be shared.');

  const { data: dup } = await db.from('community_posts').select('id').eq('project_id', project.id).eq('kind', 'showcase').in('status', ['pending_other', 'pending_review', 'live', 'held']).limit(1);
  if ((dup ?? []).length) go('/community/share', 'error', 'This project has already been shared.');
  const { count: open } = await db.from('community_posts').select('id', { count: 'exact', head: true }).eq('author_id', user.id).eq('kind', 'showcase').in('status', ['pending_other', 'pending_review']);
  if ((open ?? 0) >= MAX_OPEN_SHOWCASES) go('/community/share', 'error', 'You have a few posts waiting already. Try again once they are reviewed.');

  const title = txt(formData, 'title', 100);
  const body = txt(formData, 'body', 800);
  const city = txt(formData, 'city', 80);
  const trade = txt(formData, 'trade', 60);
  if (title.length < 3) go(back, 'error', 'Give the project a short title.');
  if (!city) go(back, 'error', 'Add the city. Only the city is shown, never the address.');
  if (!JOB_TYPES[trade]) go(back, 'error', 'Pick the kind of work.');
  if ([title, body, city].some(hasContactInfo)) go(back, 'error', NO_CONTACT);
  const dn = parseInt(txt(formData, 'days', 4), 10);
  const days = Number.isFinite(dn) && dn >= 1 && dn <= 1000 ? dn : null;
  let low: number | null = null;
  let high: number | null = null;
  if (String(formData.get('share_cost') ?? '') === '1') {
    low = parseDollars(txt(formData, 'cost_low', 12));
    high = parseDollars(txt(formData, 'cost_high', 12));
    if (low < 1_00 || high < low || high > 10_000_000_00) go(back, 'error', 'Enter the cost range as two amounts, low then high, or turn the range off.');
  }

  const beforeId = String(formData.get('before_id') ?? '');
  const afterId = String(formData.get('after_id') ?? '');
  if (!beforeId || !afterId || beforeId === afterId) go(back, 'error', 'Pick one before photo and a different after photo.');
  const { data: ph } = await db.from('photos').select('id,path').eq('project_id', project.id).in('id', [beforeId, afterId]);
  const before = (ph ?? []).find((p: any) => p.id === beforeId) as any;
  const after = (ph ?? []).find((p: any) => p.id === afterId) as any;
  if (!before || !after) go(back, 'error', 'Those photos are not from this project.');

  const id = randomUUID();
  const copy = async (from: string, to: string) => {
    const dl = await db.storage.from('project-photos').download(from);
    if (dl.error || !dl.data) return false;
    const up = await db.storage.from(COMMUNITY_BUCKET).upload(to, Buffer.from(await dl.data.arrayBuffer()), { contentType: dl.data.type || 'image/jpeg' });
    return !up.error;
  };
  const bp = `showcase/${id}/before.jpg`;
  const ap = `showcase/${id}/after.jpg`;
  if (!(await copy(before.path as string, bp)) || !(await copy(after.path as string, ap))) go(back, 'error', 'Could not copy the photos. Try again.');

  const { error } = await db.from('community_posts').insert({
    id, kind: 'showcase', author_id: user.id, author_role: side, company_id: project.company_id, project_id: project.id, title, body, trade, city, days,
    cost_low_cents: low, cost_high_cents: high, before_path: bp, after_path: ap, status: 'pending_other',
  });
  if (error) go(back, 'error', 'Could not save your post. Check that the database step was run.');

  const { data: co } = await db.from('companies').select('name').eq('id', project.company_id).maybeSingle();
  const others = await otherSideIds(db, project, side);
  await notifyUsers({
    userIds: others, projectId: null, kind: 'community', path: '/community/mine',
    title: side === 'contractor' ? `${(co?.name as string | undefined) ?? 'Your contractor'} wants to share your finished project` : 'The homeowner wants to share your finished project',
    body: 'It shows only the city, never the address or names. Nothing goes live until you approve it. Open Community to look at it.', cta: 'Review the post',
  });
  revalidatePath('/community/mine');
  go('/community/mine', 'ok', 'Sent. The other side approves it first, then Jobfile reviews it before it goes live.');
}

export async function respondShowcase(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const id = String(formData.get('post_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const db = supabaseAdmin();
  const { data: p } = await db.from('community_posts').select('*').eq('id', id).maybeSingle<Post>();
  if (!p || p.kind !== 'showcase' || p.status !== 'pending_other' || !p.project_id) redirect('/community/mine');
  const { data: project } = await db.from('projects').select('id,company_id').eq('id', p.project_id).maybeSingle<any>();
  const side = project ? await sideOf(db, project, user.id) : null;
  if (!side || side === p.author_role) redirect('/community/mine');
  const now = new Date().toISOString();
  if (decision === 'approve') {
    await db.from('community_posts').update({ status: 'pending_review', other_ok_at: now, updated_at: now }).eq('id', p.id);
    await notifyUsers({ userIds: [p.author_id], projectId: null, kind: 'community', path: '/community/mine', title: 'They approved your post', body: 'Jobfile reviews it next, then it goes live. You will get an alert.', cta: 'Open Community' });
  } else {
    await db.from('community_posts').update({ status: 'rejected', reject_reason: 'The other side chose not to share this project.', updated_at: now }).eq('id', p.id);
    await notifyUsers({ userIds: [p.author_id], projectId: null, kind: 'community', path: '/community/mine', title: 'Your post was not approved', body: 'The other side chose not to share this project. Nothing was published.', cta: 'Open Community' });
  }
  revalidatePath('/community/mine');
  go('/community/mine', 'ok', decision === 'approve' ? 'Approved. Jobfile reviews it next.' : 'Declined. Nothing was published.');
}

export async function removeMyPost(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const id = String(formData.get('post_id') ?? '');
  await supabaseAdmin().from('community_posts').update({ status: 'removed', updated_at: new Date().toISOString() }).eq('id', id).eq('author_id', user.id).neq('status', 'removed');
  revalidatePath('/community');
  revalidatePath('/community/mine');
  go('/community/mine', 'ok', 'Post removed.');
}
