'use client';

import { useState } from 'react';

type Opt = { bidId: string; name: string; price: string };

/** Separate-contracts team bid: hire both companies, or (unless it is a package) either one alone. Nothing is sent until the confirm button. */
export default function HireTeam({ bothAction, singleAction, teamBidId, total, options, pkg }: {
  bothAction: (formData: FormData) => void | Promise<void>;
  singleAction: (formData: FormData) => void | Promise<void>;
  teamBidId: string; total: string; options: Opt[]; pkg: boolean;
}) {
  const [pick, setPick] = useState<null | 'both' | string>(null);
  const one = options.find((o) => o.bidId === pick);

  if (!pick) {
    return (
      <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p className="muted small">{pkg ? 'This is a package: both companies are hired together.' : 'Hire either company, or both.'} Each company gets its own Jobfile project with its own agreement. Nothing is charged.</p>
        <button className="btn" type="button" onClick={() => setPick('both')}>Hire both · {total}</button>
        {!pkg && (
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            {options.map((o) => <button key={o.bidId} className="btn ghost" type="button" style={{ flex: 1 }} onClick={() => setPick(o.bidId)}>Hire {o.name} only</button>)}
          </div>
        )}
      </div>
    );
  }
  const both = pick === 'both';
  return (
    <form action={both ? bothAction : singleAction} className="card why" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Confirm hiring">
      {both ? <input type="hidden" name="team_bid_id" value={teamBidId} /> : <input type="hidden" name="bid_id" value={pick} />}
      <span className="lbl">Last step</span>
      <h3 style={{ fontSize: 21 }}>{both ? `Hire both companies for ${total}?` : `Hire ${one?.name} for ${one?.price}?`}</h3>
      <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <li>✓ {both ? 'Two Jobfile projects open, one for each company, with their prices and your scope.' : 'A Jobfile project opens with this company’s price and your scope.'}</li>
        <li>✓ You review and sign each agreement. <b>Nothing is charged.</b></li>
        <li>! {both ? 'The other bidders are told this project went to someone else. You can’t undo this.' : 'The other company and the other bidders are told this project went to someone else. You can’t undo this.'}</li>
      </ul>
      <button className="btn" type="submit">{both ? 'Yes, hire both' : 'Yes, hire this company'}</button>
      <button className="btn ghost" type="button" onClick={() => setPick(null)}>Not yet</button>
    </form>
  );
}
