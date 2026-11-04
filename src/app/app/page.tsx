import type { Metadata } from 'next';
import HomeScreenGuide from '@/components/HomeScreenGuide';

export const metadata: Metadata = { title: 'Add Jobfile to your Home Screen' };

export default function AppPage() {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <h1 style={{ fontSize: 'clamp(28px, 8vw, 36px)', lineHeight: 1.05, letterSpacing: '-0.03em' }}>Add Jobfile to your Home Screen</h1>
      <p className="muted" style={{ margin: 0 }}>Opens in seconds, full screen, with no browser bar. It takes about 10 seconds and uses no storage.</p>
      <HomeScreenGuide />
    </div>
  );
}
