'use client';
import { useEffect, useRef, useState } from 'react';

const ease = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * Sweep-then-settle animation for a price bar. Plays once, when the element is on screen
 * (or at once with `when: 'mount'`). With reduced motion it jumps to the finished state.
 * Returns: ref for the element to watch, `fill` (0..1 of the range band), `mark` (marker position in %),
 * `count` (0..1 for counting numbers up) and `done`.
 */
export function useSweep(end: number, opts: { when?: 'view' | 'mount'; ms?: number } = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [p, setP] = useState(0);
  const when = opts.when ?? 'view';
  const D = opts.ms ?? 2600;
  useEffect(() => {
    let raf = 0;
    let started = false;
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
    if (reduce) { setP(1); return; }
    const run = () => {
      if (started) return;
      started = true;
      let t0: number | null = null;
      const frame = (ts: number) => {
        if (t0 === null) t0 = ts;
        const x = Math.min(1, (ts - t0) / D);
        setP(x);
        if (x < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };
    let io: IntersectionObserver | null = null;
    if (when === 'mount' || typeof IntersectionObserver === 'undefined' || !ref.current) run();
    else {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { run(); io?.disconnect(); } }, { threshold: 0.5 });
      io.observe(ref.current);
    }
    return () => { cancelAnimationFrame(raf); io?.disconnect(); };
  }, [when, D]);
  const amp = (1 - p) * (1 - p) * 45;
  const mark = p >= 1 ? end : Math.max(2, Math.min(94, end + Math.sin(p * Math.PI * 5) * amp));
  return { ref, fill: ease(Math.min(1, p * 2.2)), mark, count: ease(Math.max(0, (p - 0.35) / 0.65)), done: p >= 1 };
}
