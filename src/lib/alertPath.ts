/** Where an alert should open inside a project, by what the alert is about. Safe for client and server. */
const TAB: Record<string, string> = {
  change: '/changes',
  agreement: '/agreement',
  photo: '/photos',
  payment: '/payments',
  review: '/rating',
  stage: '/overview',
  finish_request: '/overview',
  finish_cancel: '/overview',
  closeout: '/closeout',
  issue: '/issues',
  schedule: '/schedule',
  selection: '/selections',
  document: '/documents',
  visit: '/schedule',
  scope: '/overview#scope',
  closeout_ready: '/overview#closeout',
};

export function alertHref(projectId: string | null | undefined, kind: string | null | undefined): string {
  if (kind === 'help') return '/help';
  if (!projectId) return '/projects';
  return `/projects/${projectId}${TAB[kind ?? ''] ?? ''}`;
}
