import Link from 'next/link';

/** Tabs on the Projects page, only while the marketplace is on. Homeowners: Projects | Posted jobs. Contractors: Projects | Bids. */
export default function ProjectsTabs({ active, role, projects, extra }: { active: 'projects' | 'extra'; role: 'homeowner' | 'contractor'; projects: number; extra: number }) {
  const label = role === 'contractor' ? 'Bids' : 'Posted jobs';
  const href = role === 'contractor' ? '/marketplace/bids' : '/projects?tab=posted';
  const badge = (n: number, hot: boolean) => (n > 0 ? <span className="pill" style={hot ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent', marginLeft: 7, padding: '3px 8px' } : { marginLeft: 7, padding: '3px 8px' }}>{n}</span> : null);
  return (
    <nav className="ptabs" aria-label="Projects views">
      <Link href="/projects" aria-current={active === 'projects' ? 'page' : undefined}>Projects{badge(projects, false)}</Link>
      <Link href={href} aria-current={active === 'extra' ? 'page' : undefined}>{label}{badge(extra, true)}</Link>
    </nav>
  );
}
