'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireMarketplace } from '@/lib/marketplace';
import { adminEmails } from '@/lib/admin';
import { cleanSpots, shopItems, type Spot } from '@/lib/shopLook';
import { notifyUsers } from '@/lib/notify';
import { buildPrompt, cleanPicks, designEnabled, DESIGN_BUCKET, DESIGN_DAILY_LIMIT, generateImageEx, SPACES, STYLES, type Space } from '@/lib/designIdeas';

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

  const results = await Promise.all([0, 1].map((v) => generateImageEx(buf, file.type, buildPrompt(space, style, picks, notes, v))));
  const outs = results.map((r) => r.buf);
  const outOfCredit = results.some((r) => r.outOfCredit);
  if (outOfCredit) await alertOutOfCredit();
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
    back(outOfCredit ? 'Design ideas are temporarily unavailable. Please try again later.' : 'We could not make ideas from that photo. Try a clearer, well-lit photo.');
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

/** Tell the owner the image service refused for billing or quota reasons. At most one alert every 6 hours. */
async function alertOutOfCredit() {
  try {
    const db = supabaseAdmin();
    const title = 'Design ideas stopped: the AI account needs credit';
    const since = new Date(Date.now() - 6 * 3600_000).toISOString();
    const { count } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('title', title).gt('created_at', since);
    if ((count ?? 0) > 0) return;
    const emails = adminEmails();
    if (!emails.length) return;
    const { data: owners } = await db.from('profiles').select('id').in('email', emails);
    const ids = (owners ?? []).map((o) => o.id as string);
    if (!ids.length) return;
    await notifyUsers({
      userIds: ids,
      projectId: null,
      kind: 'admin',
      path: '/admin',
      title,
      body: 'Google refused a design request because the balance or quota is used up. Homeowners see "temporarily unavailable". Add credit in Google AI Studio, Billing.',
      force: true,
    });
  } catch {
    // never block the homeowner on an alert
  }
}

/** Finds where each shoppable item sits in each picture. One small AI look per picture, then kept. Returns nothing it is not sure about. */
export async function locateSpots(designId: string): Promise<{ ok: true; spots: Record<string, Spot[]> } | { ok: false; why?: string }> {
  try {
    requireMarketplace();
    if (!designEnabled() || !/^[0-9a-f-]{36}$/i.test(designId)) return { ok: false };
    const { user } = await requireUser();
    const db = supabaseAdmin();
    const { data: d } = await db.from('design_ideas').select('*').eq('id', designId).eq('user_id', user.id).maybeSingle<any>();
    if (!d) return { ok: false, why: 'design not found' };
    if (!('spots' in d)) return { ok: false, why: 'spots column missing' };
    if (d.spots && typeof d.spots === 'object') return { ok: true, spots: d.spots as Record<string, Spot[]> };
    const key = process.env.DESIGN_IMAGE_KEY;
    if ((process.env.DESIGN_PROVIDER ?? 'gemini').toLowerCase() !== 'gemini' || !key) return { ok: false, why: 'no Gemini key' };
    const items = shopItems(d.space as string, (d.picks ?? {}) as Record<string, string>);
    const results = (d.results ?? []) as string[];
    if (!items.length || !results.length) return { ok: false, why: 'no items' };
    const model = process.env.DESIGN_LOCATE_MODEL || 'gemini-2.5-flash';
    const list = items.map((it, i) => `${i + 1}. ${it.label}: ${it.desc}`).join('\n');
    const prompt = `This is a picture of a room. For each numbered item, give one point at the middle of that object in the picture. Use whole numbers from 0 to 1000 for x (left to right) and y (top to bottom). Leave an item out if you cannot clearly see it. Never guess. Items:\n${list}\nAnswer only as JSON: {"items":[{"n":1,"x":500,"y":400}]}`;
    let allOk = true;
    let why = '';
    const spots: Record<string, Spot[]> = {};
    await Promise.all(results.map(async (path, idx) => {
      try {
        const dl = await db.storage.from(DESIGN_BUCKET).download(path);
        if (dl.error || !dl.data) { allOk = false; why = 'picture download failed'; return; }
        const buf = Buffer.from(await dl.data.arrayBuffer());
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: dl.data.type || 'image/png', data: buf.toString('base64') } }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0 },
          }),
        });
        if (!r.ok) { allOk = false; why = `Gemini ${r.status}`; console.error('locateSpots', r.status, (await r.text()).slice(0, 300)); return; }
        const j = (await r.json()) as any;
        const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
        spots[String(idx)] = cleanSpots(JSON.parse(txt.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()), items.length);
      } catch (e) { allOk = false; why = 'could not read the answer'; console.error('locateSpots', e); }
    }));
    if (!allOk) return { ok: false, why };
    if (!Object.values(spots).some((a) => a.length)) return { ok: false, why: 'no items found in the picture' }; // do not save an empty result, so it can retry
    await db.from('design_ideas').update({ spots }).eq('id', designId).eq('user_id', user.id);
    return { ok: true, spots };
  } catch (e) {
    console.error('locateSpots', e);
    return { ok: false, why: 'error' };
  }
}
