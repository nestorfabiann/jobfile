'use client';

import { useState } from 'react';

/** Photos with a draggable divider. Works with finger, mouse and the arrow keys. */
export default function BeforeAfter({ before, after, alt }: { before: string; after: string; alt: string }) {
  const [p, setP] = useState(50);
  return (
    <div className="cmba" style={{ ['--p' as string]: `${p}%` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt={`${alt}, before`} draggable={false} />
      <div className="cmba-aft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={`${alt}, after`} draggable={false} />
      </div>
      <span className="cmba-tag l">Before</span>
      <span className="cmba-tag r">After</span>
      <span className="cmba-bar" aria-hidden="true" />
      <input type="range" min={0} max={100} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label="Drag to compare before and after" />
    </div>
  );
}
