-- Schedule, Selections and Documents tabs on a project. Run once in the Supabase SQL editor.
-- No policies except read-for-members: only the server writes, after it checks who is asking.

create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  position int not null default 0,
  title text not null check (char_length(title) between 1 and 120),
  note text not null default '' check (char_length(note) <= 300),
  starts_on date,
  ends_on date,
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists project_phases_project on public.project_phases (project_id, position);

create table if not exists public.schedule_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_id uuid references public.project_phases(id) on delete set null,
  summary text not null check (char_length(summary) <= 300),
  reason text not null default '' check (char_length(reason) <= 500),
  changed_by uuid references auth.users(id),
  changed_role text check (changed_role in ('contractor', 'homeowner')),
  homeowner_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists schedule_changes_project on public.schedule_changes (project_id, created_at desc);

create table if not exists public.selections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  note text not null default '' check (char_length(note) <= 500),
  affects text not null default '' check (char_length(affects) <= 120),
  needed_by date,
  status text not null default 'open' check (status in ('open', 'chosen')),
  choice text not null default '' check (char_length(choice) <= 300),
  link text not null default '' check (char_length(link) <= 500),
  created_by uuid references auth.users(id),
  chosen_by uuid references auth.users(id),
  chosen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists selections_project on public.selections (project_id, created_at);

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('permit', 'insurance', 'receipt', 'warranty', 'other')),
  title text not null check (char_length(title) between 1 and 120),
  note text not null default '' check (char_length(note) <= 300),
  path text not null,
  file_type text not null default '',
  uploaded_by uuid references auth.users(id),
  uploader_role text check (uploader_role in ('contractor', 'homeowner')),
  created_at timestamptz not null default now()
);
create index if not exists project_documents_project on public.project_documents (project_id, created_at desc);

insert into storage.buckets (id, name, public) values ('project-docs', 'project-docs', false) on conflict (id) do nothing;

alter table public.project_phases enable row level security;
alter table public.schedule_changes enable row level security;
alter table public.selections enable row level security;
alter table public.project_documents enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'project_phases' and policyname = 'phases visible') then
    create policy "phases visible" on public.project_phases for select using (public.is_project_member(project_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'schedule_changes' and policyname = 'schedule changes visible') then
    create policy "schedule changes visible" on public.schedule_changes for select using (public.is_project_member(project_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'selections' and policyname = 'selections visible') then
    create policy "selections visible" on public.selections for select using (public.is_project_member(project_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'project_documents' and policyname = 'documents visible') then
    create policy "documents visible" on public.project_documents for select using (public.is_project_member(project_id));
  end if;
end $$;
