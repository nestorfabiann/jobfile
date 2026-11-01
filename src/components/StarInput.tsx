'use client';

import { useState } from 'react';

/** Tap a star to rate. For optional rows, tap the same star again to clear it. */
export default function StarInput({ name, label, defaultValue = 0, big = false, optional = false }: { name: string; label: string; defaultValue?: number; big?: boolean; optional?: boolean }) {
  const [v, setV] = useState(defaultValue);
  return (
    <div className={big ? 'rcol' : 'rr'}>
      <span className={big ? '' : 'small'}>{label}</span>
      <input type="hidden" name={name} value={v} />
      <div className={`rstars input${big ? '' : ' sm'}`} role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={v === i}
            aria-label={`${i} star${i > 1 ? 's' : ''}`}
            className={i <= v ? 'on' : ''}
            onClick={() => setV(optional && v === i ? 0 : i)}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
