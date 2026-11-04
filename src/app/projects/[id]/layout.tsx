import Link from 'next/link';
import { loadProject } from '@/lib/project';
import ProjectTabs from '@/components/ProjectTabs';
import { priceCheckEnabled } from '@/lib/pricecheck';
import { addDays, todayChi } from '@/lib/schedule';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { sb, project, role, contractorName, homeownerName, homeownerJoined } = await loadProject(params.id);

  // A red dot on a tab means something there needs the homeowner: a choice due soon, or a date that moved.
  const dots: string[] = [];
  if (role === 'homeowner') {
    const soon = addDays(todayChi(), 3);
    const [{ count: due }, { count: moved }] = await Promise.all([
      sb.from('selections').select('id', { count: 'exact', head: true }).eq('project_id', project.id).eq('status', 'open').lte('needed_by', soon),
      sb.from('schedule_changes').select('id', { count: 'exact', head: true }).eq('project_id', project.id).is('homeowner_seen_at', null),
    ]);
    if ((due ?? 0) > 0) dots.push('Selections');
    if ((moved ?? 0) > 0) dots.push('Schedule');
  }

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

      <ProjectTabs id={project.id} priceCheck={role === 'homeowner' && priceCheckEnabled()} rating={!!project.completed_at} money={role === 'contractor'} dots={dots} />
      {children}
    </>
  );
}
