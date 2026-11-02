/** One line icon per trade. Takes the surrounding text color, so it works in light and dark. Unknown trades show nothing. */
const PATHS: Record<string, JSX.Element> = {
  'Kitchen remodel': <><path d="M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" /><path d="M3 10h18" /><path d="M9 6c0-1.5 1-1.5 1-3" /><path d="M14 6c0-1.5 1-1.5 1-3" /></>,
  Bathroom: <><path d="M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" /><path d="M6 12V6a2 2 0 0 1 4 0" /><path d="M7 19l-1 2" /><path d="M17 19l1 2" /></>,
  Painting: <><rect x="4" y="4" width="14" height="6" rx="1" /><path d="M18 7h2v5H11v3" /><rect x="9.5" y="15" width="3" height="6" rx="1" /></>,
  Roofing: <><path d="M3 12l9-8 9 8" /><path d="M6 10v10h12V10" /><path d="M10 20v-5h4v5" /></>,
  Flooring: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 10h18" /><path d="M3 15h18" /><path d="M9 5v5" /><path d="M15 10v5" /><path d="M9 15v4" /></>,
  Landscaping: <><path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z" /><path d="M5 19l8-8" /></>,
};

export default function TradeIcon({ trade, size = 16 }: { trade: string; size?: number }) {
  const p = PATHS[trade];
  if (!p) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: 6, flex: 'none' }}>
      {p}
    </svg>
  );
}
