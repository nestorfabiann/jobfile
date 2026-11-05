-- Photos attached to a reported problem. Files live in the private project-photos bucket.
create table if not exists public.issue_photos (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.project_issues(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid not null,
  side text not null check (side in ('homeowner', 'contractor')),
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists issue_photos_issue_idx on public.issue_photos (issue_id, created_at);
alter table public.issue_photos enable row level security; -- no policies: server only
