-- Scope of work progress on the project Overview. One row per scope line (agreement work line or approved change order).
create table if not exists public.project_scope_status (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  ref_kind text not null check (ref_kind in ('item', 'co')),
  ref_id uuid not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'done')),
  done_at timestamptz,
  done_by uuid references auth.users(id),
  photo_id uuid references public.photos(id) on delete set null,
  ho_reaction text check (ho_reaction in ('ok', 'question')),
  ho_note text not null default '' check (char_length(ho_note) <= 500),
  ho_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (project_id, ref_kind, ref_id)
);
create index if not exists project_scope_status_project on public.project_scope_status (project_id);
alter table public.project_scope_status enable row level security; -- no policies: server only
