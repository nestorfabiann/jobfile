'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

type Who = 'c' | 'h';

const ICONS: Record<string, ReactNode> = {
  shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  pin: <><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  pay: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  doc: <><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4" /><path d="M10 13h6M10 17h6" /></>,
  star: <path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.3l6-.7z" />,
  spark: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
};
const Ic = ({ n }: { n: string }) => (
  <span aria-hidden="true" style={{ flex: 'none', width: 36, height: 36, borderRadius: 12, background: 'var(--surface-2)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[n]}</svg>
  </span>
);
const Step = ({ i, t, d }: { i: number; t: string; d: string }) => (
  <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 10 }}>
    <span className="why-num" aria-hidden="true">{i}</span>
    <span><b>{t}</b><span className="muted small" style={{ display: 'block' }}>{d}</span></span>
  </div>
);
const Ben = ({ n, t, d }: { n: string; t: string; d: string }) => (
  <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 10 }}>
    <Ic n={n} />
    <span><b>{t}</b><span className="muted small" style={{ display: 'block' }}>{d}</span></span>
  </div>
);

/** "For contractors / For homeowners" switch on the signed-out and signed-in home page. */
export default function LandingAudience({ signedIn }: { signedIn: boolean }) {
  const [who, setWho] = useState<Who>('c');
  const profile = signedIn ? '/settings/business' : `/login?next=${encodeURIComponent('/settings/business')}`;
  const seg = (k: Who, label: string) => (
    <button type="button" role="tab" aria-selected={who === k} onClick={() => setWho(k)}
      style={{ border: 0, borderRadius: 999, minHeight: 46, font: '600 14.5px inherit', fontFamily: 'inherit', cursor: 'pointer', background: who === k ? 'var(--surface)' : 'transparent', color: who === k ? 'var(--ink)' : 'var(--ink-2)', boxShadow: who === k ? '0 1px 4px rgba(0,0,0,.15)' : 'none' }}>{label}</button>
  );
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div role="tablist" aria-label="Who is this for" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: 'var(--line)', borderRadius: 999, padding: 4 }}>
        {seg('c', 'For contractors')}{seg('h', 'For homeowners')}
      </div>

      {who === 'c' ? (
        <>
          <h2 style={{ fontSize: 24 }}>Win the job, then run it without the paperwork</h2>
          <div className="card">
            <h3 style={{ margin: 0 }}>How it works for contractors</h3>
            <Step i={1} t="Set up your business profile" d="Add your trades, service area, logo, work photos and insurance." />
            <Step i={2} t="Bid on jobs near you" d="Browse open projects by trade and ZIP. Get an alert when a new one matches." />
            <Step i={3} t="Get the job in writing" d="When a homeowner accepts, price and scope are set up for both of you to approve." />
            <Step i={4} t="Request payment as you go" d="Ask for each milestone. Both sides see what is paid and what is next." />
          </div>
          <div className="card">
            <h3 style={{ margin: 0 }}>Why contractors use Jobfile</h3>
            <Ben n="shield" t="A profile that wins bids" d="Your insurance badge, work photos and real ratings show on every bid you send." />
            <Ben n="pin" t="Jobs near you" d="Pick your trades and area. New matching projects come to you." />
            <Ben n="spark" t="An AI price reference" d="See a typical local price range for a job, to help you bid fairly." />
            <Ben n="pay" t="Payments by milestone" d="Request each payment when the work is done. Jobfile records them. It does not hold or move your money." />
            <Ben n="doc" t="Change orders you can bill" d="Extra work is approved with the price attached before you start it." />
            <Ben n="star" t="Ratings you earn" d="Finish a job and the homeowner rates you. Good work builds a public record." />
          </div>
          <div className="card">
            <h3 style={{ margin: 0 }}>What a homeowner sees when you bid</h3>
            <div style={{ border: '1px solid var(--line)', borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--surface-2)' }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><b>Your Company Name</b><span className="muted small">★ 4.9 (12)</span></div>
              <span className="pill ok" style={{ width: 'max-content' }}>✓ Insured to Mar 2027</span>
              <div style={{ fontSize: 24, fontWeight: 800 }}>$18,400</div>
              <div className="muted small">2 weeks · Starts Nov 12</div>
            </div>
            <span className="muted small">Example bid card. Insurance and ratings come from your profile.</span>
          </div>
          <div className="card" style={{ gap: 8 }}>
            <h3 style={{ margin: 0 }}>The small print, in plain words</h3>
            <p style={{ margin: 0 }}><b>Free to start.</b></p>
            <p className="muted small" style={{ margin: 0 }}>Homeowner addresses, names and phone numbers stay private until a bid is accepted.</p>
          </div>
          <Link className="btn accent" href={profile}>Create your contractor profile →</Link>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 24 }}>One shared record that protects you both</h2>
          <div className="card">
            <h3 style={{ margin: 0 }}>How it works for homeowners</h3>
            <Step i={1} t="Post your project" d="Tap the work you want done, add photos, set a budget range and location in minutes." />
            <Step i={2} t="Compare bids" d="Local contractors send proposals. Review them side by side." />
            <Step i={3} t="Know fair pricing" d="Get an AI cost reference before you commit." />
            <Step i={4} t="Run the job in Jobfile" d="Accept a bid and the project opens with scope, price, photos, payments and change orders." />
          </div>
        </>
      )}
    </div>
  );
}
