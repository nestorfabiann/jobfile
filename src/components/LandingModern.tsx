'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSweep } from '@/lib/useSweep';

type Side = 'ho' | 'co';

const ICON: Record<string, string> = {
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  pay: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  doc: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 13h6M10 17h6"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.3l6-.7z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const Svg = ({ n, size = 22 }: { n: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON[n] }} />
);

/* Small examples drawn in the page itself, so people see what a bid or a project looks like. */
const BidCard = ({ name, sub, price }: { name: string; sub: string; price?: string }) => (
  <div className="lm-vcard">
    <div className="lm-vrow">
      <span className="lm-lg">{name[0]}</span>
      <div><b>{name}</b><div className="lm-vm">{sub}</div></div>
      {price ? <span className="lm-vp">{price}</span> : null}
    </div>
    <div className="lm-vb"><span>✓ Verified</span><span>Insured to Mar 2027</span></div>
  </div>
);
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const PriceBar = () => {
  const sw = useSweep(46);
  return (
    <div className="lm-vprice" ref={sw.ref}>
      <span className="lm-sample">Sample</span>
      <div className="lm-vbar"><i style={{ width: `${56 * sw.fill}%` }} /><u style={{ left: `${sw.mark}%` }} /></div>
      <div className="lm-vm2"><span>Typical {usd(4200 * sw.count)} to {usd(6100 * sw.count)}</span><b style={{ opacity: sw.done ? 1 : 0, transition: 'opacity .4s' }}>Your bid $5,008</b></div>
    </div>
  );
};
const Radius = () => (
  <>
    <div className="lm-vrad"><i /><i /><i /><svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICON.pin }} /></div>
    <div className="lm-vchip">25 mi · Painting, Drywall</div>
  </>
);
const Private = () => (
  <div className="lm-vcard">
    <div className="lm-vm">Street address</div>
    <b>•••••• Plano, TX</b>
    <div className="lm-vm">Shared only after you hire</div>
  </div>
);

const COPY = {
  ho: {
    eye: 'For homeowners',
    h: ['Get bids from local pros. ', 'Know the price is fair.', ''],
    sub: 'Post your project free, compare real bids side by side, then keep the price, photos and payments in one shared record.',
    cta: 'Post your project, it’s free',
    fine: 'No fees. No obligation to hire. Your address stays private until you hire.',
    steps: [['Post it', 'Pick the work, add photos and a budget. Takes a few minutes.'], ['Compare bids', 'See price, insurance and ratings side by side.'], ['Run the job', 'Schedule, changes and payments in one place.']],
    bh: 'Everything for your project',
    tiles: [
      ['Know who is showing up', 'Every bid shows insurance, real ratings and work photos.', 'shield', 'ins'],
      ['Know it’s fair', 'An AI cost reference for your project before you commit, so you are not guessing.', 'spark', 'price'],
      ['Your details stay private', 'Your address and contact info go only to the contractor you hire.', 'lock', 'priv'],
    ],
    also: [['cal', 'Meet before you hire', 'Pick a time, see them at your home, then decide. Both sides confirm the visit happened.']],
    fh: 'Ready to get bids on your project?',
  },
  co: {
    eye: 'For contractors',
    h: ['Win the job, then ', 'skip the paperwork.', ''],
    sub: 'Find nearby projects, send a bid that shows your insurance and ratings, then run the job with your customer.',
    cta: 'Create your free profile',
    fine: 'No subscription. Nothing taken from jobs you win.',
    steps: [['Find work', 'New projects in your trade and area come to you.'], ['Send a bid', 'Your logo, badge, insurance and price on every bid.'], ['Get paid as you go', 'Request each milestone. Both sides see what is next.']],
    bh: 'Everything to win and run jobs',
    tiles: [
      ['A profile that wins bids', 'Your insurance badge, work photos and real ratings show on every bid you send.', 'shield', 'bid'],
      ['Jobs near you', 'Pick your trades and area. New matching projects come to you.', 'pin', 'pin'],
      ['AI price reference', 'See what a job should cost in the area before you bid, so your price is fair and competitive.', 'spark', 'price'],
      ['Rate your homeowners too', 'Homeowners rate you. You rate them. Know who pays on time, decides fast and gives access before you take the job.', 'star', 'both'],
    ],
    also: [['pay', 'Payments by milestone', 'Request each payment when the work is done. Jobfile records them. It does not hold or move your money.'], ['doc', 'Change orders you can bill', 'Extra work is approved with the price attached before you start it.'], ['cal', 'See the job first', 'Ask the homeowner for a visit before you price it. Both sides confirm it happened.']],
    fh: 'Ready to find your next job?',
  },
} as const;

function Screen({ side, step }: { side: Side; step: number }): ReactNode {
  if (side === 'ho') {
    if (step === 0) return (<>
      <div className="lm-ph">New project <span className="lm-pill o">Draft</span></div>
      <div className="lm-mini"><b>What work?</b><div className="lm-chips"><span className="on">Walls</span><span className="on">Trim and doors</span><span>Ceiling</span></div></div>
      <div className="lm-mini"><b>Budget</b><div className="lm-vm">$6,000 to $6,500</div></div>
      <div className="lm-mini"><b>Site visits</b><div className="lm-vm">Yes, weekday evenings</div></div>
      <div className="lm-mini lm-go">Publish project</div></>);
    if (step === 1) return (<>
      <div className="lm-ph">3 bids <span className="lm-pill b">Compare</span></div>
      <div className="lm-mini"><b>Nesty’s Painting</b> <span className="lm-pill">✓ Verified</span><div className="lm-price">$5,008</div><div className="lm-bar"><i /><u /></div><div className="lm-vm">Typical range · insured to Mar 2027</div></div>
      <div className="lm-mini"><b>Plano Pro Paint</b><div className="lm-price">$6,200</div><div className="lm-vm">★ 4.8 · 12 reviews</div></div>
      <div className="lm-mini"><b>Lone Star Finishes</b><div className="lm-price">$5,750</div><div className="lm-vm">★ 4.9 · 8 reviews</div></div></>);
    return (<>
      <div className="lm-ph">Needs you <span className="lm-pill o">2</span></div>
      <div className="lm-mini"><b>Pick a time for the site visit</b><div className="lm-vm">Thu, Nov 13 · 10:00 am</div></div>
      <div className="lm-mini"><b>Choose: Kitchen tile</b><div className="lm-vm">Needed by Fri</div></div>
      <div className="lm-mini"><b>Payments</b><div className="lm-ms"><span>Deposit</span><span className="lm-pill">Paid</span></div><div className="lm-ms"><span>Midpoint</span><span className="lm-pill o">Requested</span></div></div></>);
  }
  if (step === 0) return (<>
    <div className="lm-ph">Open near you <span className="lm-pill b">3</span></div>
    <div className="lm-mini"><b>Kitchen and walls painting</b><div className="lm-vm">Plano · 1,800 sq ft</div><div className="lm-price sm">$6,000 to $6,500</div></div>
    <div className="lm-mini"><b>Bathroom remodel</b><div className="lm-vm">Frisco · 3 bids</div></div>
    <div className="lm-mini"><b>Fence replacement</b><div className="lm-vm">McKinney · 0 bids</div></div>
    <div className="lm-map" aria-hidden="true">
      <svg viewBox="0 0 250 96" preserveAspectRatio="none"><rect width="250" height="96" fill="#ece7da" /><path d="M0 70 Q60 55 120 66 T250 50" stroke="#fff" strokeWidth="7" fill="none" /><path d="M40 0 L70 96" stroke="#fff" strokeWidth="5" fill="none" /><path d="M160 0 Q150 40 190 96" stroke="#fff" strokeWidth="5" fill="none" /><path d="M0 30 Q90 20 250 28" stroke="#f6f2e8" strokeWidth="3" fill="none" /><ellipse cx="205" cy="22" rx="26" ry="10" fill="#cfe3d3" /><ellipse cx="22" cy="84" rx="20" ry="8" fill="#cfe3d3" /></svg>
      <span className="lm-pin" style={{ left: '25%', top: '62%' }}><i>1</i></span>
      <span className="lm-pin" style={{ left: '56%', top: '40%' }}><i>2</i></span>
      <span className="lm-pin" style={{ left: '82%', top: '77%' }}><i>3</i></span>
      <span className="lm-smp">Sample</span>
    </div></>);
  if (step === 1) return (<>
    <div className="lm-ph">Your bid</div>
    <div className="lm-mini"><BidCard name="Nesty’s Painting" sub="4 weeks · starts Nov 19" price="$5,008" /></div>
    <div className="lm-mini"><b>Included</b><div className="lm-vm">Paint, prep and cleanup</div></div>
    <div className="lm-mini lm-go">Send bid</div></>);
  return (<>
    <div className="lm-ph">Payments</div>
    <div className="lm-mini">
      <div className="lm-ms"><span>Deposit at signing</span><span className="lm-pill">Confirmed</span></div>
      <div className="lm-ms"><span>Midpoint</span><span className="lm-pill o">Request</span></div>
      <div className="lm-ms"><span>Substantial completion</span><span className="lm-vm">Next</span></div>
      <div className="lm-ms"><span>Final walkthrough</span><span className="lm-vm">Later</span></div></div>
    <div className="lm-mini"><b>CO-2 +$420</b><div className="lm-vm">Approved · own payment line</div></div></>);
}

const Both = () => (
  <div className="lm-pair">
    <div className="lm-half"><span className="lm-who">You get rated</span><span className="lm-st5" aria-label="5 stars">★★★★★</span><div><span>Quality</span><b>5.0</b></div><div><span>On time</span><b>4.8</b></div></div>
    <div className="lm-half"><span className="lm-who">You rate them</span><span className="lm-st5" aria-label="4 stars">★★★★☆</span><div><span>Paid on time</span><b>5.0</b></div><div><span>Quick decisions</span><b>4.0</b></div></div>
  </div>
);

function Visual({ k }: { k: string }) {
  if (k === 'both') return <Both />;
  if (k === 'ins') return <BidCard name="Plano Pro Paint" sub="★ 4.8 (12) · work photos" />;
  if (k === 'bid') return <BidCard name="Nesty’s Painting" sub="★ 4.9 (12)" price="$5,008" />;
  if (k === 'pin') return <Radius />;
  if (k === 'price') return <PriceBar />;
  return <Private />;
}

/** Signed-out home: a side switch, a live phone preview, tappable steps, trust row, feature tiles. Children (open jobs, invites) sit before the closing call to action. */
export default function LandingModern({ signedIn, nums, children }: { signedIn: boolean; nums: [string, string][]; children?: ReactNode }) {
  const [side, setSide] = useState<Side>('ho');
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [trackOpen, setTrackOpen] = useState<number | null>(null);
  // Autoplay for the three steps: starts a moment after the section is on screen, stops for good when someone taps a step.
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [held, setHeld] = useState(false);
  const [reduce, setReduce] = useState(false);
  const stepsRef = useRef<HTMLElement | null>(null);
  const STEP_MS = 4000;
  useEffect(() => {
    try { setReduce(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { /* fine */ }
    const el = stepsRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.45 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    setReady(false);
    if (!inView || stopped || reduce) return;
    setStep(0);
    const t = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(t);
  }, [inView, stopped, reduce]);
  useEffect(() => {
    if (!ready || held || stopped || reduce) return;
    const t = setTimeout(() => setStep((x) => (x + 1) % 3), STEP_MS);
    return () => clearTimeout(t);
  }, [ready, held, stopped, reduce, step]);
  const c = COPY[side as Side];
  const homeHref = signedIn ? '/marketplace/new' : `/login?next=${encodeURIComponent('/marketplace/new')}`;
  const proHref = signedIn ? '/settings/business' : `/login?next=${encodeURIComponent('/settings/business')}`;
  const cta = side === 'ho' ? homeHref : proHref;
  const choose = (s: Side) => { setSide(s); setStep(0); setOpen(null); };

  return (
    <div className="lm">
      <section className="lm-hero">
        <span className="lm-eyebrow">{c.eye}</span>
        <h1>{c.h[0]}<em>{c.h[1]}</em>{c.h[2]}</h1>
        <p className="lm-sub">{c.sub}</p>
        <div className="lm-seg" role="tablist" aria-label="I am a">
          <button type="button" role="tab" aria-selected={side === 'ho'} onClick={() => choose('ho')}>I&rsquo;m a homeowner</button>
          <button type="button" role="tab" aria-selected={side === 'co'} onClick={() => choose('co')}>I&rsquo;m a contractor</button>
        </div>
        <Link className="lm-cta" href={cta}>{c.cta} →</Link>
        <p className="lm-fine">{c.fine}</p>
      </section>

      <section className="lm-proof" aria-label="Why trust Jobfile">
        {side === 'ho' && (
          <div className="lm-fair">
            <span className="lm-fl">See what it should cost</span>
            <b>Know the price before you talk to anyone</b>
            <span className="lm-fj">Example: interior painting · 3 rooms · Plano</span>
            <div className="lm-fbar"><i /><u /></div>
            <div className="lm-frg"><span>Typical <b>$4,200 to $6,100</b></span><span><b>$5,008</b> bid</span></div>
            <span className="lm-ff">An estimate to guide you, not a quote.</span>
          </div>
        )}
        <div className="lm-founder"><span className="lm-fav" aria-hidden="true">N</span><span><b>Built by a Texas painting contractor</b></span></div>
        {nums.length > 0 && (
          <div className="lm-nums" aria-label="Jobfile so far">
            {nums.map(([n, t]) => (<div key={t}><b>{n}</b><span>{t}</span></div>))}
          </div>
        )}
      </section>

      <section className="lm-stage" aria-label="Preview of the app">
        <div className="lm-phone"><div key={`${side}-${step}`} className="lm-fade"><Screen side={side} step={step} /></div></div>
      </section>

      <section ref={stepsRef} className={`lm-steps${held ? ' lm-hold' : ''}`} aria-label="How it works"
        onPointerDown={() => setHeld(true)} onPointerUp={() => setHeld(false)} onPointerCancel={() => setHeld(false)} onPointerLeave={() => setHeld(false)}>
        <h2>How it works in 3 steps</h2>
        {c.steps.map(([t, d], i) => (
          <button key={t} type="button" className="lm-st" aria-pressed={step === i} onClick={() => { setStep(i); setStopped(true); }}>
            <span className="lm-n">{i + 1}</span>
            <span><b>{t}</b><span className="lm-d">{d}</span></span>
            {step === i && ready && !stopped && !reduce ? <i key={`${side}-${step}`} className="lm-sbar" style={{ animationDuration: `${STEP_MS}ms` }} aria-hidden="true" /> : null}
          </button>
        ))}
      </section>

      <section className="lm-trustwrap" aria-label="Why people trust Jobfile">
        <h2 className="lm-trusth">Why Jobfile</h2>
        <div className="lm-trust">
          {([['shield', 'Insurance checked', 'We review each pro’s license and insurance before they bid.', 'o'], ['pin', 'Address stays private', 'Only the pro you hire sees where you live.', 'g'], ['clock', 'Free, no fees', 'Post, bid and hire without paying Jobfile.', 'o'], ['star', 'Built for Texas', 'Made for Texas homes, codes and weather.', 'g']] as const).map(([ic, t, d, tone], i) => (
            <div key={t} style={{ animationDelay: `${i * 70}ms` }}>
              <span className={`lm-tic ${tone}`} aria-hidden="true"><Svg n={ic} size={18} /></span>
              <b>{t}</b>
              <span className="lm-td">{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lm-mid" aria-label="Get started">
        <Link className="lm-cta" href={cta}>{c.cta} →</Link>
        <p className="lm-fine">{side === 'ho' ? 'You choose. No obligation to hire anyone.' : 'No subscription. Nothing taken from jobs you win.'}</p>
      </section>

      {side === 'ho' && (
        <div className="lm-both" role="note">
          <span aria-hidden="true"><Svg n="shield" size={20} /></span>
          <span className="lm-bt">
            <span><b>Ratings go both ways.</b> You see each pro’s real track record, and pros show up prepared too.</span>
            <span className="lm-bp"><i>You rate them <em aria-hidden="true">★★★★★</em></i><i>Pros rate the job <em aria-hidden="true">★★★★★</em></i></span>
          </span>
        </div>
      )}

      <section className="lm-bento" aria-label="What you get">
        <h2>{c.bh}</h2>
        {c.tiles.map(([t, d, ic, vis], i) => (
          <div key={t} className={`lm-tile ${i === 0 || i === 3 ? 'lead' : i === 1 ? 'or' : 'gr'}`}>
            <span className="lm-ti"><Svg n={ic} /></span>
            <b>{t}</b>
            <p>{d}</p>
            <div className="lm-vis"><Visual k={vis} /></div>
          </div>
        ))}
      </section>

      <section className="lm-track" aria-label="Never miss an update">
        <div className="lm-trackh">
          <span className="lm-bell" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#f6c744" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          </span>
          <h2>Never miss an update</h2>
          <p>{side === 'ho' ? 'Every message, photo, change and payment is tracked in one place, so you always know where things stand.' : 'Every message, photo, change and payment is tracked in one place, so nothing is lost and you always have the record.'}</p>
        </div>
        <ol className="lm-tl">
          {([
            ['Price and scope agreed', 'Written down, both sides see it', 'No more “that is not what we agreed.”', 'Interior paint, 3 rooms', '$2,400'],
            ['Change approved', 'Nothing extra without a yes', 'No more “I never approved that.”', 'Extra coat on ceiling, +$180', 'Approved ✓'],
            ['Photos added', 'Progress and the finished work', 'No more “I never saw that.”', '12 photos · Day 3 of 5', 'New'],
            ['Payment recorded', 'A record you can come back to', 'No more “I never got paid” or “I already paid.”', 'Deposit $800 · marked paid', 'Recorded ✓'],
          ] as const).map(([t, d, pay, ex, tag], i) => (
            <li key={t} className={`${i === 3 ? 'done' : ''}${trackOpen === i ? ' open' : ''}`}>
              <button type="button" className="lm-tbtn" aria-expanded={trackOpen === i} onClick={() => setTrackOpen(trackOpen === i ? null : i)}>
                <i aria-hidden="true">{i === 3 ? '✓' : i + 1}</i>
                <span className="lm-ttx"><b>{t}</b><span>{d}</span><em>{pay}</em>
                  {trackOpen === i ? <span className="lm-tex"><span>{ex}</span><strong>{tag}</strong></span> : null}
                </span>
                <span className="lm-tchv" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="lm-tapnote">Tap a step to see an example</p>
        <p className="lm-peace"><b>Less worry, fewer arguments.</b> Peace of mind for homeowners and pros.</p>
      </section>

      {c.also.filter(([ic]) => ic === 'cal').map(([ic, t, d]) => (
        <section key={t} className="lm-meet" aria-label={t}>
          <span className="lm-tic o" aria-hidden="true"><Svg n={ic} size={18} /></span>
          <b>{t}</b>
          <p>{d}</p>
        </section>
      ))}

      {c.also.some(([ic]) => ic !== 'cal') && <section className="lm-also" aria-label="And also">
        <h3>And also</h3>
        {c.also.filter(([ic]) => ic !== 'cal').map(([ic, t, d], i) => (
          <div key={t}>
            <button type="button" className="lm-alt" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span className="lm-ai"><Svg n={ic} /></span><b>{t}</b>
              <svg className="lm-chev" viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {open === i && <p className="lm-altd">{d}</p>}
          </div>
        ))}
      </section>}

      {children}

      <section className="lm-final">
        <h2>{c.fh}</h2>
        <p>Free to start. Nothing to download.</p>
        <Link className="lm-cta" href={signedIn ? '/projects' : cta}>{signedIn ? 'Go to Projects →' : `${c.cta} →`}</Link>
      </section>
    </div>
  );
}
