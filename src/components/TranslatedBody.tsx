'use client';

import { useEffect, useState, useTransition } from 'react';
import { translateMessage } from '@/app/projects/[id]/translate';

const T = {
  en: { translate: 'Translate', original: 'Show original', translated: 'Translated by AI', busy: 'Translating…' },
  es: { translate: 'Traducir', original: 'Ver original', translated: 'Traducido por IA', busy: 'Traduciendo…' },
} as const;

export default function TranslatedBody({
  id,
  body,
  lang,
  auto,
  initial,
}: {
  id: string;
  body: string;
  lang: 'en' | 'es';
  auto: boolean;
  initial: { text: string; same: boolean } | null;
}) {
  const t = T[lang];
  const [tr, setTr] = useState<string | null>(initial && !initial.same ? initial.text : null);
  const [same, setSame] = useState(!!initial?.same);
  const [show, setShow] = useState(auto && !!initial && !initial.same);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();

  function run() {
    setErr('');
    start(async () => {
      const r = await translateMessage(id, lang);
      if (!r.ok) return setErr(r.error);
      if (r.same) return setSame(true);
      setTr(r.text);
      setShow(true);
    });
  }

  useEffect(() => {
    if (auto && !tr && !same) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <p lang={show && tr ? lang : undefined}>{show && tr ? tr : body}</p>
      {!same && (
        <div className="row small muted" style={{ gap: 10 }}>
          {tr ? (
            <>
              <button type="button" className="linkbtn" style={{ color: 'var(--brand)' }} onClick={() => setShow(!show)}>
                {show ? t.original : t.translate}
              </button>
              {show && <span>{t.translated}</span>}
            </>
          ) : (
            <button type="button" className="linkbtn" style={{ color: 'var(--brand)' }} onClick={run} disabled={busy}>
              {busy ? t.busy : t.translate}
            </button>
          )}
          {err && <span role="alert" style={{ color: 'var(--bad)' }}>{err}</span>}
        </div>
      )}
    </>
  );
}
