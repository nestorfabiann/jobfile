-- Partners on a contractor's own project (jobs that did not come from the marketplace).
-- The lead company adds a partner by email. The partner sees only their own part, never the homeowner's contact details or the total.
create table if not exists project_partners (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  lead_company_id uuid not null references companies(id) on delete cascade,
  invited_by uuid not null,
  partner_company_id uuid references companies(id) on delete set null,
  partner_name text not null default '',
  partner_email text not null default '',
  scope text not null default '',
  price_cents integer not null default 0,
  counter_cents integer,
  start_date date,
  end_date date,
  paid_cents integer not null default 0,
  status text not null default 'invited' check (status in ('invited','countered','accepted','declined','removed')),
  removed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_partners_project_idx on project_partners(project_id);
create index if not exists project_partners_company_idx on project_partners(partner_company_id);
create index if not exists project_partners_email_idx on project_partners(partner_email);
alter table project_partners enable row level security;

create table if not exists partner_messages (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references project_partners(id) on delete cascade,
  sender_id uuid not null,
  sender_side text not null check (sender_side in ('lead','partner')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists partner_messages_partner_idx on partner_messages(partner_id, created_at);
alter table partner_messages enable row level security;
