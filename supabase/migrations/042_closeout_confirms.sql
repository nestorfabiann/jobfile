-- Closeout checklist: each side confirms scope, extra work and payments before a job is closed.
create table if not exists closeout_confirms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  role text not null check (role in ('homeowner','contractor')),
  user_id uuid not null,
  scope jsonb not null default '{}'::jsonb,
  homeowner_paid_cents integer,
  payment_answer text check (payment_answer in ('received','not_received')),
  note text not null default '',
  confirmed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, role)
);
alter table closeout_confirms enable row level security;
