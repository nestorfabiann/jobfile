/** Names a path for the usage log. Never includes ids, query strings or anything typed by a person. */
export function pageName(path: string): string {
  const p = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  if (p === '/') return 'Home';
  if (p.startsWith('/admin')) return 'Admin';
  if (p === '/projects') return 'Projects';
  const proj = p.match(/^\/projects\/[^/]+(?:\/([a-z-]+))?/);
  if (proj) return proj[1] ? `Project: ${proj[1]}` : 'Project';
  if (p === '/marketplace') return 'Find work';
  if (p === '/marketplace/new') return 'Post a project';
  if (p === '/marketplace/bids') return 'Bids';
  if (p.startsWith('/marketplace/')) return 'Listing';
  if (p === '/settings') return 'Settings';
  if (p === '/settings/business') return 'Business profile';
  if (p.startsWith('/settings/business/')) return 'Business: money';
  if (p === '/find') return 'Find contractors';
  if (p.startsWith('/contractors/')) return 'Contractor profile';
  if (p === '/invite') return 'Invite friends';
  if (p === '/help') return 'Help';
  if (p === '/jobs' || p.startsWith('/jobs/')) return 'Open jobs';
  if (p.startsWith('/invites')) return 'Invites';
  return 'Other';
}
