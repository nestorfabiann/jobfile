import { supabaseAdmin } from '@/lib/supabase/server';
import { visitTodo, type Visit } from '@/lib/visits';
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

  // A visit waiting on this person (pick a time, or propose times) also lights up Schedule.
  const { data: vrows } = await supabaseAdmin().from('visits').select('*').eq('project_id', project.id).in('status', ['requested', 'proposed']);
  if (((vrows ?? []) as unknown as Visit[]).some((v) => visitTodo(v, role as 'homeowner' | 'contractor')) && !dots.includes('Schedule')) dots.push('Schedule');

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

      <ProjectTabs id={project.id} priceCheck={role === 'homeowner' && priceCheckEnabled()} rating={!!project.completed_at} money={role === 'contractor'} dots={dots} />

      {role === 'contractor' && !homeownerJoined && (
        <div className="box warn">
          {homeownerName} has not signed in yet. Messages and the agreement are also emailed to {project.homeowner_email} with a
          sign-in link.
        </div>
      )}

      {project.is_homestead && (
        <details className="box warn">
          <summary style={{ cursor: 'pointer' }}><b>Homestead job.</b> Texas has extra contract rules. Tap to read them.</summary>
          <p style={{ margin: '8px 0 0' }}>
            Texas requires a written contract, signed by both spouses if the owner is married, before work or materials start, and
            filed with the county clerk. Track these steps on the Agreement tab. Have a Texas construction attorney review your contract.
          </p>
        </details>
      )}

      {children}
    </>
  );
}
