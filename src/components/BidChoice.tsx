'use client';

import { useState } from 'react';

/** One choice for answering a job: bid alone, or bid as a team. Both panels are rendered by the server and this only switches between them. */
export default function BidChoice({ alone, team }: { alone: React.ReactNode; team: React.ReactNode }) {
  const [tab, setTab] = useState<'alone' | 'team'>('alone');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role="tablist" aria-label="How to bid" className="bchoice">
        <button type="button" role="tab" id="bid-tab-alone" aria-selected={tab === 'alone'} aria-controls="bid-panel-alone" onClick={() => setTab('alone')}>
          <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" /></svg>
          <b>Bid alone</b>
          <span>Your price, your scope</span>
        </button>
        <button type="button" role="tab" id="bid-tab-team" aria-selected={tab === 'team'} aria-controls="bid-panel-team" onClick={() => setTab('team')}>
          <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M17 14c2.5 0 4 2 4 5" /></svg>
          <b>Bid as a team</b>
          <span>Partner up on bigger jobs</span>
          <i className="bchoice-new">New</i>
        </button>
      </div>
      <div role="tabpanel" id="bid-panel-alone" aria-labelledby="bid-tab-alone" hidden={tab !== 'alone'}>{alone}</div>
      <div role="tabpanel" id="bid-panel-team" aria-labelledby="bid-tab-team" hidden={tab !== 'team'}>{team}</div>
    </div>
  );
}

