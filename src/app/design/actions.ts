'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireMarketplace } from '@/lib/marketplace';
import { buildPrompt, cleanPicks, designEnabled, DESIGN_BUCKET, DESIGN_DAILY_LIMIT, generateImage, SPACES, STYLES, type Space } from '@/lib/designIdeas';

const back = (msg: string): never => redirect(`/design?error=${encodeURIComponent(msg)}`);

export async function createDesign(fd: FormData) {
  requireMarketplace();
  if (!designEnabled()) back('Design ideas are not turned on yet.');
  const { user } = await requireUser();
  const db = supabaseAdmin();
  // Homeowners only.
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  if ((mem ?? []).length > 0) back('Design ideas are for homeowners.');
  if (fd.get('consent') !== 'on') back('Please tick the box to confirm the photo can be sent to an AI service.');

  const space = String(fd.get('space') ?? '') as Space;
  if (!(space in SPACES)) back('Pick a room.');
  const style = (STYLES as readonly string[]).includes(String(fd.get('style'))) ? String(fd.get('style')) : '';
  const notes = String(fd.get('notes') ?? '').trim().slice(0, 300);
  const picks = cleanPicks(space, Object.fromEntries(fd.entries()));

  const f = fd.get('photo');
  if (!(f instanceof File) || f.size === 0) back('Add a photo of the room.');
  const file = f as File;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) back('Use a JPG, PNG or WebP photo.');
  if (file.size > 6 * 1024 * 1024) back('That photo is too large. Try a smaller one.');

  // Daily limit: each idea costs money.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from('design_ideas').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
  if ((count ?? 0) >= DESIGN_DAILY_LIMIT) back(`You can make ${DESIGN_DAILY_LIMIT} design sets a day. Try again tomorrow.`);

  const buf = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID();
  const originalPath = `${user.id}/${id}/original.jpg`;
  const up = await db.storage.from(DESIGN_BUCKET).upload(originalPath, buf, { contentType: file.type });
  if (up.error) back('Could not upload the photo. Try again.');

  const outs = await Promise.all([0, 1].map((v) => generateImage(buf, file.type, buildPrompt(space, style, picks, notes, v))));
  const paths: string[] = [];
  for (let i = 0; i < outs.length; i++) {
    const o = outs[i];
    if (!o) continue;
    const p = `${user.id}/${id}/idea-${i + 1}.png`;
    const s = await db.storage.from(DESIGN_BUCKET).upload(p, o, { contentType: 'image/png' });
    if (!s.error) paths.push(p);
  }
  if (!paths.length) {
    await db.storage.from(DESIGN_BUCKET).remove([originalPath]);
    back('We could not make ideas from that photo. Try a clearer, well-lit photo.');
  }
  const { error } = await db.from('design_ideas').insert({ id, user_id: user.id, space, style, picks, notes, original_path: originalPath, results: paths });
  if (error) back('Could not save your ideas. Try again.');
  redirect(`/design/${id}`);
}

export async function deleteDesign(fd: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const id = String(fd.get('id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/design');
  const { data: row } = await db.from('design_ideas').select('original_path,results').eq('id', id).eq('user_id', user.id).maybeSingle<any>();
  if (row) {
    await db.storage.from(DESIGN_BUCKET).remove([row.original_path as string, ...((row.results ?? []) as string[])]);
    await db.from('design_ideas').delete().eq('id', id).eq('user_id', user.id);
  }
  redirect('/design');
}
