import Link from 'next/link';
import { loadProject } from '@/lib/project';
import ProjectTabs from '@/components/ProjectTabs';
import { priceCheckEnabled } from '@/lib/pricecheck';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { project, role, contractorName, homeownerName, homeownerJoined } = await loadProject(params.id);

  return (
    <>
      <div className="stack">
        <Link href="/projects" className="small">‹ All projects</Link>
        <h1>{project.name}</h1>
        <div className="row">
          <span className={`pill ${role}`}>You: {role}</span>
          <span className="muted small">
            {[project.address, `${contractorName} · ${homeownerName}`].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>

      {role === 'contractor' && !homeownerJoined && (
        <div className="box warn">
          {homeownerName} has not signed in yet. Messages and the agreement are also emailed to {project.homeowner_email} with a
          sign-in link.
        </div>
      )}

      {project.is_homestead && (
        <div className="box warn">
          <b>Homestead job.</b> Texas requires a written contract, signed by both spouses if the owner is married, before work or
          materials start, and filed with the county clerk. Track these steps on the Agreement tab. Have a Texas construction
          attorney review your contract.
        </div>
      )}

      <ProjectTabs id={project.id} priceCheck={role === 'homeowner' && priceCheckEnabled()} rating={!!project.completed_at} money={role === 'contractor'} />
      {children}
    </>
  );
}
