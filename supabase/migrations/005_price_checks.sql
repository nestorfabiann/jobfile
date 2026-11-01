-- Homeowner price checks. Private to the person who ran them. To remove the feature later: drop table public.price_checks;
create table if not exists public.price_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  area text not null,
  finish text not null,
  notes text not null default '',
  model text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists price_checks_project on public.price_checks (project_id, created_at desc);

alter table public.price_checks enable row level security;
drop policy if exists "own price checks" on public.price_checks;
create policy "own price checks" on public.price_checks for select
  using (requested_by = auth.uid() and public.is_project_member(project_id));
