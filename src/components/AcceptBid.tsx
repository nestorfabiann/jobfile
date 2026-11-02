'use client';

import { useState } from 'react';

/** Accept this bid: first tap asks to confirm, second tap sends it. Nothing is sent until the confirm button is used. */
export default function AcceptBid({ action, bidId, name, price }: { action: (formData: FormData) => void | Promise<void>; bidId: string; name: string; price: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p className="muted small">Accepting opens a Jobfile project with this price and your scope filled in, and tells the other bidders. Nothing is charged. You both still review and sign the agreement.</p>
        <div className="row"><button className="btn" type="button" onClick={() => setConfirming(true)}>Accept this bid</button></div>
      </div>
    );
  }
  return (
    <form action={action} className="card why" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Confirm accepting this bid">
      <input type="hidden" name="bid_id" value={bidId} />
      <span className="lbl">Last step</span>
      <h3 style={{ fontSize: 21 }}>Accept {name} for {price}?</h3>
      <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <li>✓ A Jobfile project opens with this price, your scope and the start date from this bid.</li>
        <li>✓ You review and sign the agreement together. <b>Nothing is charged.</b></li>
        <li>! The other bidders are told this project went to someone else, and your project closes to new bids. You can&rsquo;t undo this.</li>
      </ul>
      <div className="row"><button className="btn" type="submit">Yes, accept this bid</button></div>
      <div className="row"><button className="btn ghost" type="button" onClick={() => setConfirming(false)}>Not yet</button></div>
    </form>
  );
}
