-- Photos, payments and project stage. Run once in the Supabase SQL editor after 001 and 002.

-- Project stage: derived from the agreement plus these two dates.
alter table public.projects add column if not exists closeout_started_at timestamptz;
alter table public.projects add column if not exists completed_at timestamptz;

-- Private storage bucket for photos. No storage policies are created on purpose:
-- only the server (service role) reads and writes files, after it checks who is asking.
insert into storage.buckets (id, name, public)
values ('project-photos', 'project-photos', false)
on conflict (id) do nothing;

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  uploader_role text not null check (uploader_role in ('contractor', 'homeowner')),
  kind text not null default 'progress' check (kind in ('progress', 'fix')),
  caption text not null default '' check (char_length(caption) <= 500),
  path text not null,
  status text not null default 'open' check (status in ('open', 'fixed', 'confirmed')),
  status_changed_by uuid references auth.users(id),
  status_changed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists photos_project on public.photos (project_id, created_at desc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.agreement_milestones(id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  method text not null default 'check' check (method in ('check', 'cash', 'ach', 'card', 'other')),
  paid_on date not null default current_date,
  note text not null default '' check (char_length(note) <= 500),
  recorded_by uuid not null references auth.users(id),
  recorded_role text not null check (recorded_role in ('contractor', 'homeowner')),
  status text not null default 'recorded' check (status in ('recorded', 'confirmed', 'disputed')),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_project on public.payments (project_id, paid_on desc);

alter table public.photos enable row level security;
alter table public.payments enable row level security;

drop policy if exists "photos visible to members" on public.photos;
create policy "photos visible to members" on public.photos for select using (public.is_project_member(project_id));
drop policy if exists "payments visible to members" on public.payments;
create policy "payments visible to members" on public.payments for select using (public.is_project_member(project_id));
