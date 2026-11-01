import { loadProject } from '@/lib/project';
import AutoRefresh from '@/components/AutoRefresh';
import MessageForm from '@/components/MessageForm';
import TranslatedBody from '@/components/TranslatedBody';
import { asLang, translateEnabled } from '@/lib/translate';

const TZ = 'America/Chicago';
const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });

export default async function Messages({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const { sb, user, project, role, contractorName, homeownerName } = await loadProject(params.id);
  const otherName = role === 'contractor' ? homeownerName : contractorName;

  const { data: messages } = await sb
    .from('messages')
    .select('id,sender_id,sender_role,tag,body,created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true })
    .limit(300);

  // Translation (optional). Only touches the new columns and table when the feature flag is on.
  const tOn = translateEnabled();
  let lang: 'en' | 'es' = 'en';
  let auto = false;
  const cached: Record<string, { text: string; same: boolean }> = {};
  const autoIds = new Set<string>();
  if (tOn) {
    const { data: prof } = await sb.from('profiles').select('language,auto_translate').eq('id', user.id).maybeSingle();
    lang = asLang(prof?.language);
    auto = prof?.auto_translate ?? true;
    const ids = (messages ?? []).map((m) => m.id);
    if (ids.length) {
      const { data: rows } = await sb.from('message_translations').select('message_id,body,same').eq('lang', lang).in('message_id', ids);
      (rows ?? []).forEach((r) => (cached[r.message_id] = { text: r.body, same: r.same }));
    }
    // Only the newest incoming messages are translated automatically. Older ones use the button.
    (messages ?? [])
      .filter((m) => m.sender_id !== user.id)
      .slice(-25)
      .forEach((m) => autoIds.add(m.id));
  }

  let lastDay = '';
  return (
    <>
      <AutoRefresh seconds={15} />
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      <section className="thread" aria-label="Messages">
        {(messages ?? []).length === 0 && (
          <div className="card">
            <p className="muted">No messages yet. Questions, site updates and decisions go here, so nothing lives only in a text thread.</p>
          </div>
        )}
        {(messages ?? []).map((m) => {
          const d = dayOf(m.created_at);
          const showDay = d !== lastDay;
          lastDay = d;
          const name = m.sender_role === 'contractor' ? contractorName : homeownerName;
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showDay && (
                <div className="lbl" style={{ alignSelf: 'center', padding: '6px 0 2px' }}>
                  {d}
                </div>
              )}
              <article className={`msg ${m.sender_role}${m.sender_id === user.id ? ' mine' : ''}`}>
                <header>
                  <b>{m.sender_id === user.id ? 'You' : name}</b>
                  {m.tag ? (
                    <span className={`pill ${m.tag === 'decision' ? 'ok' : m.tag === 'question' ? 'warn' : ''}`}>{m.tag}</span>
                  ) : null}
                  <time>{stamp(m.created_at)}</time>
                </header>
                {tOn && m.sender_id !== user.id ? (
                  <TranslatedBody id={m.id} body={m.body} lang={lang} auto={auto && autoIds.has(m.id)} initial={cached[m.id] ?? null} />
                ) : (
                  <p>{m.body}</p>
                )}
              </article>
            </div>
          );
        })}
      </section>

      <MessageForm projectId={project.id} otherName={otherName} hint={tOn ? 'Write in English or Spanish. The other person can translate it.' : undefined} />
    </>
  );
}
