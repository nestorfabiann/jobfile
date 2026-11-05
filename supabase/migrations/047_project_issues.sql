-- Guided problem resolution between homeowner and contractor.
create table if not exists public.project_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reporter_id uuid not null,
  reporter_role text not null check (reporter_role in ('homeowner', 'contractor')),
  category text not null,
  description text not null check (char_length(description) between 10 and 2000),
  wants text not null default '',
  status text not null default 'open' check (status in ('open', 'agreed', 'withdrawn')),
  respond_by timestamptz not null,
  escalated_at timestamptz,
  escalated_by uuid,
  agreed_summary text not null default '',
  agreed_at timestamptz,
  ai_options jsonb,
  mediator_note text not null default '',
  mediator_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_issues_project_idx on public.project_issues (project_id, created_at desc);
create index if not exists project_issues_status_idx on public.project_issues (status);
alter table public.project_issues enable row level security; -- no policies: server only

create table if not exists public.issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.project_issues(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid,
  side text not null check (side in ('homeowner', 'contractor', 'jobfile')),
  kind text not null check (kind in ('report', 'proposal', 'accept', 'note', 'recommendation', 'withdraw', 'escalate')),
  fix text not null default '',
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  on_date date,
  body text not null default '' check (char_length(body) <= 2000),
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists issue_events_issue_idx on public.issue_events (issue_id, created_at);
alter table public.issue_events enable row level security; -- no policies: server only
