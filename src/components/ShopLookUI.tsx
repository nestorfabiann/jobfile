'use client';

import { useEffect, useState } from 'react';
import { locateSpots } from '@/app/design/actions';

export type ShopLite = { n: number; label: string; swatch: string };
type Spot = { n: number; x: number; y: number };

function jump(n?: number) {
  const el = document.getElementById(n ? `shop-${n}` : 'shop') as HTMLDetailsElement | null;
  if (!el) return;
  if (n && 'open' in el) el.open = true;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/** Small card under the photo: tells people the shop section exists and jumps to it. */
export function ShopStrip({ items, withDots }: { items: ShopLite[]; withDots: boolean }) {
  return (
    <div className="shs">
      <div className="shs-t"><b>Shop this look</b><small>{withDots ? 'Tap a dot or a swatch' : `${items.length} item${items.length === 1 ? '' : 's'}`}</small></div>
      <div className="shs-sw">
        {items.map((it) => (
          <button type="button" key={it.n} className="shs-c" onClick={() => jump(it.n)}><i style={{ background: it.swatch }} aria-hidden="true" />{it.n} {it.label}</button>
        ))}
      </div>
      <button type="button" className="shs-go" onClick={() => jump()}>Find these items ↓</button>
    </div>
  );
}

/** The picture with tappable dots on the items. Dots appear only for items the app could place. */
export function ShopPhoto({ designId, index, src, alt, items, initial, canLocate }: { designId: string; index: number; src: string; alt: string; items: ShopLite[]; initial: Spot[] | null; canLocate: boolean }) {
  const [spots, setSpots] = useState<Spot[]>(initial ?? []);
  const [open, setOpen] = useState(0);
  const [why, setWhy] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if ((initial !== null && !tick) || !canLocate) return;
    let alive = true;
    setWhy('');
    locateSpots(designId).then((r) => { if (!alive) return; if (r.ok) setSpots(r.spots[String(index)] ?? []); else setWhy(r.why ?? 'unknown'); }).catch(() => { if (alive) setWhy('network'); });
    return () => { alive = false; };
  }, [designId, index, initial, canLocate, tick]);
  const cur = spots.find((s) => s.n === open);
  const item = cur ? items.find((i) => i.n === cur.n) : undefined;
  return (
    <div className="shp">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
      {spots.map((s) => (
        <button type="button" key={s.n} className={`shp-dot${open === s.n ? ' on' : ''}`} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }} aria-label={`${items.find((i) => i.n === s.n)?.label ?? 'Item'}: tap to find this item`} onClick={() => setOpen(open === s.n ? 0 : s.n)}>{s.n}</button>
      ))}
      {cur && item ? (
        <div className="shp-tip" style={{ left: `${Math.min(Math.max(cur.x * 100, 28), 72)}%`, top: `${cur.y > 0.6 ? cur.y * 100 - 14 : cur.y * 100 + 7}%` }}>
          <b>{item.label}</b>
          <button type="button" onClick={() => { setOpen(0); jump(item.n); }}>Find this item ›</button>
        </div>
      ) : null}
      {why && !spots.length ? <button type="button" className="shp-why" onClick={() => setTick((t) => t + 1)}>Dots could not load ({why}). Tap to retry</button> : null}
    </div>
  );
}
