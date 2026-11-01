/** A simple drawn kitchen used as the default project picture. */
export default function KitchenArt({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" role="img" aria-label="Kitchen illustration" style={{ borderRadius: 14, flex: 'none' }}>
      <rect width="72" height="72" fill="#e6eeff" />
      <rect x="0" y="52" width="72" height="20" fill="#c9d7f2" />
      {/* window */}
      <rect x="27" y="10" width="18" height="16" rx="2" fill="#bfe0ff" stroke="#fff" strokeWidth="2" />
      <path d="M36 10v16M27 18h18" stroke="#fff" strokeWidth="1.5" />
      {/* upper cabinets */}
      <rect x="4" y="8" width="19" height="18" rx="2" fill="#ff7a1a" />
      <rect x="49" y="8" width="19" height="18" rx="2" fill="#ff7a1a" />
      <path d="M13.5 8v18M58.5 8v18" stroke="#d95f06" strokeWidth="1" />
      <circle cx="11.5" cy="17" r="1" fill="#fff" /><circle cx="15.5" cy="17" r="1" fill="#fff" />
      <circle cx="56.5" cy="17" r="1" fill="#fff" /><circle cx="60.5" cy="17" r="1" fill="#fff" />
      {/* counter and base cabinets */}
      <rect x="2" y="38" width="68" height="5" rx="1.5" fill="#fff" />
      <rect x="4" y="43" width="64" height="21" rx="2" fill="#1b56e0" />
      <path d="M26 43v21M46 43v21" stroke="#0a33a8" strokeWidth="1" />
      <circle cx="22" cy="50" r="1.2" fill="#fff" /><circle cx="30" cy="50" r="1.2" fill="#fff" />
      <circle cx="42" cy="50" r="1.2" fill="#fff" /><circle cx="50" cy="50" r="1.2" fill="#fff" />
      {/* pot on the counter */}
      <rect x="31" y="31" width="10" height="7" rx="1.5" fill="#0e1a2e" />
      <path d="M30 31h12" stroke="#0e1a2e" strokeWidth="1.5" />
    </svg>
  );
}
