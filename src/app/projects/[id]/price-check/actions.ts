'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { askClaude, DAILY_LIMIT, FINISHES, priceCheckEnabled, type Finish } from '@/lib/pricecheck';

const page = (id: string, q = '') => `/projects/${id}/price-check${q}`;
function fail(id: string, msg: string): never {
  redirect(page(id, `?error=${encodeURIComponent(msg)}`));
}

/** Homeowner-only. Reads the agreement lines they can see, asks for ranges, saves the answer. */
export async function runPriceCheck(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const { sb, user, role, project } = await loadProject(projectId);
  if (role !== 'homeowner') fail(project.id, 'Price check is for homeowners.');
  if (!priceCheckEnabled()) fail(project.id, 'Price check is not turned on yet.');

  const admin = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await admin
    .from('price_checks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .gt('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) fail(project.id, `You can run ${DAILY_LIMIT} price checks per project per day. Try again tomorrow.`);

  const { data: items } = await sb
    .from('agreement_items')
    .select('id,title,description,kind,price_cents')
    .eq('project_id', project.id)
    .order('position');
  const lines = (items ?? []).map((i: any) => ({ ...i, price_cents: Number(i.price_cents) })).filter((i: any) => i.price_cents > 0);
  if (!lines.length) fail(project.id, 'The agreement has no priced items to check yet.');

  const area = String(formData.get('area') ?? '').trim().slice(0, 120) || String(project.address || '');
  if (!area) fail(project.id, 'Enter the city or ZIP code where the work is.');
  const f = String(formData.get('finish') ?? 'standard');
  const finish: Finish = f in FINISHES ? (f as Finish) : 'standard';
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 500);

  const r = await askClaude({ projectName: project.name, area, finish, notes, lines });
  if (!r.ok) fail(project.id, r.error);

  const { error } = await admin.from('price_checks').insert({
    project_id: project.id,
    requested_by: user.id,
    area,
    finish,
    notes,
    model: r.model,
    result: r.result,
  });
  if (error) fail(project.id, 'Could not save the result. Check that the price check database step was run.');

  revalidatePath(page(project.id));
  redirect(page(project.id));
}
