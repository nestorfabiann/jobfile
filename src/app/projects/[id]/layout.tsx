import { supabaseAdmin } from '@/lib/supabase/server';
import { visitTodo, type Visit } from '@/lib/visits';
import Link from 'next/link';
import { loadProject } from '@/lib/project';
import HomesteadNotice from '@/components/HomesteadNotice';
import ProjectTabs from '@/components/ProjectTabs';
import ScrollTop from '@/components/ScrollTop';
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

  // Problems tab: shows once the agreement is signed. Counts open problems and those the other side reported.
  let problems: { open: number; mine: number } | null = null;
  const { data: agrRow } = await sb.from('agreements').select('executed_at').eq('project_id', project.id).maybeSingle();
  if (agrRow?.executed_at) {
    problems = { open: 0, mine: 0 };
    try {
      const { data: iss } = await supabaseAdmin().from('project_issues').select('reporter_role').eq('project_id', project.id).eq('status', 'open');
      const rows = (iss ?? []) as { reporter_role: string }[];
      problems = { open: rows.length, mine: rows.filter((r) => r.reporter_role !== role).length };
    } catch { /* table not created yet */ }
  }

  return (
    <>
      <ScrollTop />
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

      <ProjectTabs id={project.id} priceCheck={role === 'homeowner' && priceCheckEnabled()} rating={!!project.completed_at} money={role === 'contractor'} team={role === 'contractor'} dots={dots} problems={problems} />

      {role === 'contractor' && !homeownerJoined && (
        <div className="box warn">
          {homeownerName} has not signed in yet. Messages and the agreement are also emailed to {project.homeowner_email} with a
          sign-in link.
        </div>
      )}

      {project.is_homestead && <HomesteadNotice id={project.id} />}

      {children}
    </>
  );
}
