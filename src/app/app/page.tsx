import type { Metadata } from 'next';
import HomeScreenGuide from '@/components/HomeScreenGuide';

export const metadata: Metadata = { title: 'Get the Jobfile app' };

export default function AppPage() {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <h1 style={{ fontSize: 'clamp(28px, 8vw, 36px)', lineHeight: 1.05, letterSpacing: '-0.03em' }}>Get the Jobfile app</h1>
      <p className="muted" style={{ margin: 0 }}>Bids and replies on your phone in about 10 seconds. No App Store needed.</p>
      <ul className="gta">
        <li><b>Instant alerts</b><span>Know the moment a contractor bids or a homeowner replies.</span></li>
        <li><b>One tap to open</b><span>Jobfile sits on your Home Screen with your other apps.</span></li>
        <li><b>Full screen</b><span>No browser bars. It looks and feels like an app.</span></li>
      </ul>
      <HomeScreenGuide />
    </div>
  );
}
