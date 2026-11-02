/** One line icon per trade. Takes the surrounding text color, so it works in light and dark. Unknown trades show nothing. */
const PATHS: Record<string, JSX.Element> = {
  'Kitchen remodel': <><path d="M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" /><path d="M3 10h18" /><path d="M9 6c0-1.5 1-1.5 1-3" /><path d="M14 6c0-1.5 1-1.5 1-3" /></>,
  Bathroom: <><path d="M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" /><path d="M6 12V6a2 2 0 0 1 4 0" /><path d="M7 19l-1 2" /><path d="M17 19l1 2" /></>,
  Painting: <><rect x="4" y="4" width="14" height="6" rx="1" /><path d="M18 7h2v5H11v3" /><rect x="9.5" y="15" width="3" height="6" rx="1" /></>,
  Roofing: <><path d="M3 12l9-8 9 8" /><path d="M6 10v10h12V10" /><path d="M10 20v-5h4v5" /></>,
  Flooring: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 10h18" /><path d="M3 15h18" /><path d="M9 5v5" /><path d="M15 10v5" /><path d="M9 15v4" /></>,
  Landscaping: <><path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z" /><path d="M5 19l8-8" /></>,
  Plumbing: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  Electrical: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  HVAC: <><path d="M12 3v18" /><path d="M4.2 7.5l15.6 9" /><path d="M19.8 7.5l-15.6 9" /></>,
  'Windows and doors': <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M12 3v18" /><path d="M5 12h14" /></>,
  'Siding and exterior': <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M5 14h14" /><path d="M5 17.5h14" /></>,
  Fencing: <><path d="M4 21V8l2-3 2 3v13" /><path d="M10 21V8l2-3 2 3v13" /><path d="M16 21V8l2-3 2 3v13" /><path d="M3 12h18" /><path d="M3 17h18" /></>,
  'Decks and patios': <><path d="M3 10h18" /><path d="M5 10v10" /><path d="M19 10v10" /><path d="M3 14h18" /><path d="M8 10v4" /><path d="M12 10v4" /><path d="M16 10v4" /></>,
  'Concrete and driveways': <><path d="M8 3L5 21" /><path d="M16 3l3 18" /><path d="M12 4v3" /><path d="M12 11v3" /><path d="M12 18v3" /></>,
  'Drywall and carpentry': <><rect x="3" y="8" width="18" height="8" rx="1" /><path d="M7 8v3" /><path d="M11 8v4" /><path d="M15 8v3" /><path d="M19 8v4" /></>,
  Garage: <><path d="M3 10l9-6 9 6v10H3z" /><path d="M7 20v-7h10v7" /><path d="M7 15h10" /><path d="M7 17.5h10" /></>,
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
