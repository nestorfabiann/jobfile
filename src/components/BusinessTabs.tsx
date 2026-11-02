import Link from 'next/link';

/** Profile | Bids tabs for contractors. Only shown when the marketplace is on. */
export default function BusinessTabs({ active }: { active: 'profile' | 'bids' }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`btn ${on ? '' : 'ghost'}`} style={{ minHeight: 38, padding: '6px 16px' }} aria-current={on ? 'page' : undefined}>{label}</Link>
  );
  return (
    <nav className="row" aria-label="Business">
      {tab('/settings/business', 'Profile', active === 'profile')}
      {tab('/marketplace/bids', 'Bids', active === 'bids')}
    </nav>
  );
}
