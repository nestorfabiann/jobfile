-- Homeowners can invite a contractor to bid on a posted project, or ask a question first.
-- A question is always about one project and goes through a masked thread (no phone numbers or emails).
create table if not exists bid_invites (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references marketplace_listings(id) on delete cascade,
  homeowner_id uuid not null,
  company_id uuid not null references companies(id) on delete cascade,
  note text not null default '',
  status text not null default 'invited' check (status in ('invited','asked','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, company_id)
);
create index if not exists bid_invites_company_idx on bid_invites(company_id);
create index if not exists bid_invites_homeowner_idx on bid_invites(homeowner_id, created_at);
alter table bid_invites enable row level security;

create table if not exists invite_messages (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references bid_invites(id) on delete cascade,
  sender_id uuid not null,
  sender_side text not null check (sender_side in ('homeowner','contractor')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists invite_messages_invite_idx on invite_messages(invite_id, created_at);
alter table invite_messages enable row level security;
