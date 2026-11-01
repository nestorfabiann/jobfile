'use server';

import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { asLang, DAILY_LIMIT, translateEnabled, translateText } from '@/lib/translate';

export type TranslateResult = { ok: true; text: string; same: boolean } | { ok: false; error: string };

export async function translateMessage(messageId: string, langIn: string): Promise<TranslateResult> {
  if (!translateEnabled()) return { ok: false, error: 'Translation is turned off.' };
  const { sb, user } = await requireUser();
  const lang = asLang(langIn);

  // Row level security only returns messages from projects this person belongs to.
  const { data: msg } = await sb.from('messages').select('id,body').eq('id', messageId).maybeSingle();
  if (!msg) return { ok: false, error: 'Message not found.' };

  const admin = supabaseAdmin();
  const { data: hit } = await admin
    .from('message_translations')
    .select('body,same')
    .eq('message_id', msg.id)
    .eq('lang', lang)
    .maybeSingle();
  if (hit) return { ok: true, text: hit.body, same: hit.same };

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await admin
    .from('message_translations')
    .select('message_id', { count: 'exact', head: true })
    .eq('requested_by', user.id)
    .gt('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return { ok: false, error: 'Daily translation limit reached. Try again tomorrow.' };

  const r = await translateText(msg.body, lang);
  if (!r.ok) return r;
  await admin
    .from('message_translations')
    .upsert({ message_id: msg.id, lang, body: r.text, same: r.same, model: r.model, requested_by: user.id });
  return { ok: true, text: r.text, same: r.same };
}
