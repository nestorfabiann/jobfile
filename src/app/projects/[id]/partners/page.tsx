import { redirect } from 'next/navigation';
import { loadProject } from '@/lib/project';
import ProjectPartners from '@/components/ProjectPartners';

export const dynamic = 'force-dynamic';

export default async function Team({ params }: { params: { id: string } }) {
  const { project, role } = await loadProject(params.id);
  if (role !== 'contractor') redirect(`/projects/${project.id}/overview`);
  return <ProjectPartners projectId={project.id} role="contractor" />;
}
