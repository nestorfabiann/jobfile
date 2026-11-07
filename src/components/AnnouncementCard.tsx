'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { announceDismiss, announceSeen, announceTap } from '@/app/announce/actions';
import { COLORS, type Ann } from '@/lib/announceShared';

type Props = { ann: Pick<Ann, 'id' | 'title' | 'body' | 'button_text' | 'button_href' | 'style' | 'color' | 'image_alt' | 'image_mode'>; imageUrl: string | null };

export default function AnnouncementCard({ ann, imageUrl }: Props) {
  const [gone, setGone] = useState(false);
  const [shown, setShown] = useState(false);
  const [from, to] = COLORS[ann.color] ?? COLORS.green;
  const isSheet = ann.style === 'sheet';

  useEffect(() => {
    void announceSeen(ann.id).catch(() => {});
    const t = setTimeout(() => setShown(true), 150);
    return () => clearTimeout(t);
  }, [ann.id]);

  useEffect(() => {
    if (!isSheet || gone) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSheet, gone]);

  const dismiss = () => { setShown(false); setTimeout(() => setGone(true), 350); void announceDismiss(ann.id).catch(() => {}); };
  if (gone) return null;

  const href = ann.button_href;
  const external = /^https:/i.test(href);
  const tap = () => { void announceTap(ann.id).catch(() => {}); };
  const btn = ann.button_text && href ? (
    external
      ? <a className="ann-go" href={href} target="_blank" rel="noopener noreferrer" onClick={tap}>{ann.button_text}</a>
      : <Link className="ann-go" href={href} onClick={tap}>{ann.button_text}</Link>
  ) : null;
  const img = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="ann-img" src={imageUrl} alt={ann.image_alt} loading="lazy" />
  ) : null;

  if (ann.style === 'picture' && ann.image_mode === 'full' && imageUrl) {
    const inner = <>{img}</>;
    return (
      <section className={`ann ann-full${shown ? ' show' : ''}`} aria-label={ann.title}>
        <button type="button" className="ann-x on-img" onClick={dismiss} aria-label="Close">×</button>
        {href ? (external
          ? <a href={href} target="_blank" rel="noopener noreferrer" onClick={tap} className="ann-imglink">{inner}</a>
          : <Link href={href} onClick={tap} className="ann-imglink">{inner}</Link>) : inner}
        <div className="ann-fullbar">{btn}<button type="button" className="ann-later" onClick={dismiss}>Not now</button></div>
      </section>
    );
  }

  if (isSheet) {
    return (
      <div className={`ann-sheetwrap${shown ? ' show' : ''}`} role="dialog" aria-modal="true" aria-label={ann.title}>
        <div className="ann-dim" onClick={dismiss} />
        <div className="ann-sheet">
          {img}
          <div className="ann-sb">
            <b>{ann.title}</b>
            {ann.body ? <p>{ann.body}</p> : null}
            {btn}
            <button type="button" className="ann-later" onClick={dismiss}>Not now</button>
          </div>
        </div>
      </div>
    );
  }

  if (ann.style === 'picture') {
    return (
      <section className={`ann ann-top${shown ? ' show' : ''}`} aria-label={ann.title}>
        <button type="button" className="ann-x" onClick={dismiss} aria-label="Close">×</button>
        {img}
        <div className="ann-sb"><b>{ann.title}</b>{ann.body ? <p>{ann.body}</p> : null}{btn}</div>
      </section>
    );
  }

  return (
    <section className={`ann ann-banner${shown ? ' show' : ''}`} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} aria-label={ann.title}>
      <button type="button" className="ann-x" onClick={dismiss} aria-label="Close">×</button>
      <b>{ann.title}</b>
      {ann.body ? <p>{ann.body}</p> : null}
      {btn ? <span className="ann-btnrow" style={{ ['--annc' as any]: from }}>{btn}</span> : null}
    </section>
  );
}
