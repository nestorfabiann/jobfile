import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Jobfile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The picture that shows when a Jobfile link is pasted into WhatsApp, Facebook, iMessage and so on. */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg, #c4813f, #a8692c)', color: '#fff' }}>
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -4, display: 'flex' }}>Jobfile</div>
        <div style={{ fontSize: 54, fontWeight: 700, marginTop: 24, lineHeight: 1.15, display: 'flex' }}>Free for contractors and homeowners</div>
        <div style={{ fontSize: 34, marginTop: 28, opacity: 0.92, display: 'flex' }}>Local bids. One shared record of the whole project.</div>
      </div>
    ),
    size,
  );
}
