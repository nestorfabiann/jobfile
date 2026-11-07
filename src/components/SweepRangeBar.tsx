'use client';
import { barPos } from '@/lib/barPos';
import { useSweep } from '@/lib/useSweep';

/** Same bar as RangeBar, but the marker sweeps and settles once when it appears. */
export default function SweepRangeBar({ price, lo, hi }: { price: number; lo: number; hi: number }) {
  const sw = useSweep(barPos(price, lo, hi), { when: 'mount', ms: 2200 });
  return (
    <div ref={sw.ref} role="img" aria-label="Most likely price inside the AI range" style={{ position: 'relative', height: 10, borderRadius: 8, background: 'var(--line)', margin: '14px 0 6px' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '18%', width: `${60 * sw.fill}%`, borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 45%, transparent)' }} />
      <div style={{ position: 'absolute', top: -5, width: 4, height: 20, borderRadius: 2, background: 'var(--ink)', left: `${sw.mark}%` }} />
    </div>
  );
}
