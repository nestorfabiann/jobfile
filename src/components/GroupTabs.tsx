'use client';

import { useEffect, useState, type ReactNode } from 'react';

type Tab = { key: string; label: string; count: number; badge?: number; panel: ReactNode; empty: string };

/** Ongoing / Bids / Completed. One group shows at a time so nothing is far down the page. */
export default function GroupTabs({ tabs, initial }: { tabs: Tab[]; initial: string }) {
  const [cur, setCur] = useState(initial);
  // A link ending in #bids (or #ongoing, #completed, #done) opens that tab.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace('#', '');
      const k = h === 'done' ? 'completed' : h;
      if (tabs.some((t) => t.key === k)) setCur(k);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const active = tabs.find((t) => t.key === cur) ?? tabs[0];
  return (
    <div className="gtabs-wrap">
      <div className="gtabs" role="tablist" aria-label="Your projects">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" id={`gt-${t.key}`} aria-selected={t.key === active.key} aria-controls="gt-panel" onClick={() => setCur(t.key)}>
            <em>{t.count}</em><span>{t.label}</span>
            {t.badge ? <span className="gtabs-dot" aria-label={`${t.badge} new`}>{t.badge}</span> : null}
          </button>
        ))}
      </div>
      <div id="gt-panel" role="tabpanel" aria-labelledby={`gt-${active.key}`} className="stack">
        {active.count > 0 ? active.panel : <p className="muted" style={{ margin: 0 }}>{active.empty}</p>}
      </div>
    </div>
  );
}
