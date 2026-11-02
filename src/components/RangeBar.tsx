import { barPos } from '@/lib/barPos';

/** Shows where a price sits against the AI range. The pale band is the AI range; the dark mark is the price. */
export default function RangeBar({ price, lo, hi }: { price: number; lo: number; hi: number }) {
  return (
    <div role="img" aria-label="Price compared with the AI range" style={{ position: 'relative', height: 10, borderRadius: 8, background: 'var(--line)', margin: '14px 0 6px' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '18%', width: '60%', borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 45%, transparent)' }} />
      <div style={{ position: 'absolute', top: -5, width: 4, height: 20, borderRadius: 2, background: 'var(--ink)', left: `${barPos(price, lo, hi)}%` }} />
    </div>
  );
}
