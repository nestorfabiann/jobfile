import type { Metadata } from 'next';
import HomeScreenGuide from '@/components/HomeScreenGuide';

export const metadata: Metadata = { title: 'Get the Jobfile app' };

export default function AppPage() {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <h1 style={{ fontSize: 'clamp(28px, 8vw, 36px)', lineHeight: 1.05, letterSpacing: '-0.03em' }}>Get the Jobfile app</h1>
      <p className="muted" style={{ margin: 0 }}>Bids and replies on your phone in about 10 seconds. No App Store needed.</p>
      <div className="gta-stage" aria-hidden="true">
        <div className="gta-ph gta-a">
          <i className="gta-notch" />
          <div className="gta-hs">{Array.from({ length: 12 }, (_, i) => (i === 2 ? <i key={i} className="gta-jf">J</i> : <i key={i} />))}</div>
        </div>
        <div className="gta-ph gta-b">
          <i className="gta-notch" />
          <div className="gta-lock">
            <div className="gta-d">Thursday, November 13</div>
            <div className="gta-t">9:41</div>
            <div className="gta-nt"><span className="gta-ni">J</span><div><b>New bid: $5,008</b>Nesty&rsquo;s Painting bid on Kitchen and walls painting.<small>Jobfile &middot; now</small></div></div>
            <div className="gta-nt"><span className="gta-ni">J</span><div><b>Pick a time for the site visit</b>Thu, 10:00 am<small>Jobfile &middot; 2m ago</small></div></div>
          </div>
        </div>
      </div>
      <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>Sample screens. Names and prices are examples.</p>
      <ul className="gta">
        <li><b>Instant alerts</b><span>Know the moment a contractor bids or a homeowner replies.</span></li>
        <li><b>One tap to open</b><span>Jobfile sits on your Home Screen with your other apps.</span></li>
        <li><b>Full screen</b><span>No browser bars. It looks and feels like an app.</span></li>
      </ul>
      <HomeScreenGuide />
    </div>
  );
}
