'use client';

import { useState } from 'react';

/** One choice for answering a job: bid alone, or bid as a team. Both panels are rendered by the server and this only switches between them. */
export default function BidChoice({ alone, team }: { alone: React.ReactNode; team: React.ReactNode }) {
  const [tab, setTab] = useState<'alone' | 'team'>('alone');
  const btn = (on: boolean): React.CSSProperties => ({ flex: 1, border: 0, borderRadius: 11, padding: '11px 8px', fontWeight: 700, fontSize: 15, cursor: 'pointer', background: on ? 'var(--surface, #fff)' : 'transparent', color: on ? 'var(--ink, #1b1a18)' : 'var(--ink-2, #6b655e)', boxShadow: on ? '0 1px 5px rgba(0,0,0,.14)' : 'none' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role="tablist" aria-label="How to bid" style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 14, background: 'var(--surface-2, #eee9df)' }}>
        <button type="button" role="tab" id="bid-tab-alone" aria-selected={tab === 'alone'} aria-controls="bid-panel-alone" onClick={() => setTab('alone')} style={btn(tab === 'alone')}>Bid alone</button>
        <button type="button" role="tab" id="bid-tab-team" aria-selected={tab === 'team'} aria-controls="bid-panel-team" onClick={() => setTab('team')} style={btn(tab === 'team')}>Bid as a team <span style={{ color: 'var(--accent, #c4813f)', fontSize: 12 }}>New</span></button>
      </div>
      <div role="tabpanel" id="bid-panel-alone" aria-labelledby="bid-tab-alone" hidden={tab !== 'alone'}>{alone}</div>
      <div role="tabpanel" id="bid-panel-team" aria-labelledby="bid-tab-team" hidden={tab !== 'team'}>{team}</div>
    </div>
  );
}
