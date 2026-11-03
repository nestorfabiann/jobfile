'use client';

import { useState } from 'react';
import Link from 'next/link';

const ICONS: Record<string, string> = {
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  pay: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  doc: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 13h6M10 17h6"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.3l6-.7z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
};
function Ic({ n }: { n: string }) {
  return (
    <span className="why-ic" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[n] }} />
    </span>
  );
}
const Soon = () => <span className="pill" style={{ marginLeft: 6, verticalAlign: 'middle' }}>Coming soon</span>;

/** Signed-out home page: a switch between the contractor pitch and the homeowner steps. */
export default function LandingPitch({ aiOn, signedIn }: { aiOn: boolean; signedIn: boolean }) {
  const [who, setWho] = useState<'c' | 'h'>('c');
  const go = signedIn ? '/settings/business' : `/login?next=${encodeURIComponent('/settings/business')}`;
  const post = signedIn ? '/marketplace/new' : `/login?next=${encodeURIComponent('/marketplace/new')}`;
  const seg = (on: boolean) => ({ border: 0, borderRadius: 999, minHeight: 46, font: '600 14.5px inherit', fontFamily: 'inherit', cursor: 'pointer', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-2)', boxShadow: on ? '0 1px 4px rgba(0,0,0,.15)' : 'none' }) as const;
  const steps = (list: [string, string, boolean?][]) => list.map(([t, d, soon], i) => (
    <div key={t} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 10 }}>
      <span className="why-num" aria-hidden="true">{i + 1}</span>
      <span><b>{t}</b>{soon ? <Soon /> : null}<span className="muted small" style={{ display: 'block' }}>{d}</span></span>
    </div>
  ));
  return (
    <section className="stack" aria-label="How Jobfile works">
      <div role="tablist" aria-label="Who is this for" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: 'var(--line)', borderRadius: 999, padding: 4 }}>
        <button type="button" role="tab" aria-selected={who === 'c'} onClick={() => setWho('c')} style={seg(who === 'c')}>For contractors</button>
        <button type="button" role="tab" aria-selected={who === 'h'} onClick={() => setWho('h')} style={seg(who === 'h')}>For homeowners</button>
      </div>

      {who === 'c' ? (
        <>
          <h2 style={{ fontSize: 24 }}>Win the job, then run it without the paperwork</h2>
          <div className="card">
            <h3 style={{ margin: 0 }}>How it works for contractors</h3>
            {steps([
              ['Set up your business profile', 'Add your trades, service area, logo, work photos and insurance.'],
              ['Bid on jobs near you', 'Browse open projects by trade and ZIP. Get an alert when a new one matches.'],
              ['Get the job in writing', 'When a homeowner accepts, price and scope are set up for both of you to approve.'],
              ['Request payment as you go', 'Ask for each milestone. Both sides see what is paid and what is next.'],
            ])}
          </div>
          <div className="card">
            <h3 style={{ margin: 0 }}>Why contractors use Jobfile</h3>
            {([
              ['shield', 'A profile that wins bids', 'Your insurance badge, work photos and real ratings show on every bid you send.'],
              ['pin', 'Jobs near you', 'Pick your trades and area. New matching projects come to you.'],
              ['spark', 'AI price reference', 'See what a job should cost in the area before you bid, so your price is fair and competitive.', true],
              ['pay', 'Payments by milestone', 'Request each payment when the work is done. Jobfile records them. It does not hold or move your money.'],
              ['doc', 'Change orders you can bill', 'Extra work is approved with the price attached before you start it.'],
              ['star', 'Ratings you earn', 'Finish a job and the homeowner rates you. Good work builds a public record.'],
            ] as [string, string, string, boolean?][]).map(([ic, t, d, ai]) => (
              <div key={t} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 12 }}>
                <Ic n={ic} />
                <p style={{ margin: 0 }}><b>{t}</b>{ai && !aiOn ? <Soon /> : null}<span className="muted small" style={{ display: 'block' }}>{d}</span></p>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 style={{ margin: 0 }}>What a homeowner sees when you bid</h3>
            <div className="card" style={{ background: 'var(--bg)', gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><b>Your Company Name</b><span className="muted small">★ 4.9 (12)</span></div>
              <span className="pill ok" style={{ width: 'max-content' }}>✓ Insured to Mar 2027</span>
              <div style={{ fontSize: 24, fontWeight: 800 }}>$18,400</div>
              <div className="muted small">2 weeks · Starts Nov 12</div>
            </div>
            <span className="muted small">Example bid card. Insurance and ratings come from your profile.</span>
          </div>
          <div className="card" style={{ gap: 6 }}>
            <h3 style={{ margin: 0 }}>Your customers&apos; privacy</h3>
            <span className="muted small">Homeowner addresses, names and phone numbers stay private until a bid is accepted. Free to start.</span>
          </div>
          <Link className="btn" href={go}>Create your contractor profile →</Link>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 24 }}>One shared record that protects you both</h2>
          <div className="card">
            <h3 style={{ margin: 0 }}>How it works for homeowners</h3>
            {steps([
              ['Post your project', 'Tap the work you want done, add photos, set a budget range and location in minutes.'],
              ['Compare bids', 'Local contractors send proposals. Review them side by side.'],
              ['Know fair pricing', 'Get an AI cost reference before you commit.', !aiOn],
              ['Run the job in Jobfile', 'Accept a bid and the project opens with scope, price, photos, payments and change orders.'],
            ])}
          </div>
          <div className="card">
            <h3 style={{ margin: 0 }}>Why homeowners use Jobfile</h3>
            {([
              ['spark', 'Know if the price is fair', 'An AI cost reference for your project before you commit, so you are not guessing.', true],
              ['shield', "Know who's showing up", 'Every bid shows insurance, real ratings and work photos.'],
              ['pin', 'Your details stay private', 'Your address and contact info go only to the contractor you hire. Ask questions first without giving out your number.'],
              ['doc', 'Everything in one record', 'Price, scope, photos, changes and payments in one place, not lost in texts.'],
              ['star', 'Built for Texas', 'Homestead steps are tracked for you.'],
            ] as [string, string, string, boolean?][]).map(([ic, t, d, ai]) => (
              <div key={t} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 12 }}>
                <Ic n={ic} />
                <p style={{ margin: 0 }}><b>{t}</b>{ai && !aiOn ? <Soon /> : null}<span className="muted small" style={{ display: 'block' }}>{d}</span></p>
              </div>
            ))}
          </div>
          <span className="pill ok" style={{ width: 'max-content' }}>Free for homeowners</span>
          <Link className="btn" href={post}>Post a project, it&apos;s free →</Link>
        </>
      )}
    </section>
  );
}
