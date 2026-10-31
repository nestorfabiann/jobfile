-- Jobfile phase 1b: agreements, signatures, change orders. Run after 001_init.sql.
-- All money is stored as whole cents.

create table public.agreements (
  project_id uuid primary key references public.projects(id) on delete cascade,
  revision int not null default 1,
  exclusions text not null default '',
  start_date date,
  end_date date,
  working_hours text not null default 'Mon–Fri, 8:00 am–5:00 pm',
  permits_by text not null default 'contractor' check (permits_by in ('contractor', 'homeowner')),
  warranty_months int not null default 12 check (warranty_months between 0 and 240),
  cleanup text not null default 'Contractor removes debris and cleans the work area daily and at completion.',
  disputes text not null default 'Written notice, 10 days to fix the issue, then mediation before any legal action.',
  -- The contractor sends the draft to the homeowner. Editing clears this and any signatures.
  sent_at timestamptz,
  -- Texas: the homeowner saw the statutory disclosure statement before signing.
  disclosure_ack_at timestamptz,
  -- Texas homestead tracking. Jobfile records these steps. It does not perform them.
  homestead_spouse_confirmed boolean not null default false,
  homestead_filed_on date,
  executed_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.agreement_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  position int not null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  kind text not null default 'work' check (kind in ('work', 'allowance')),
  price_cents bigint not null default 0 check (price_cents >= 0)
);
create index agreement_items_project on public.agreement_items (project_id, position);

create table public.agreement_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  position int not null,
  label text not null check (char_length(label) between 1 and 200),
  pct numeric(5, 2) not null check (pct >= 0 and pct <= 100)
);
create index agreement_milestones_project on public.agreement_milestones (project_id, position);

-- One signature per side. A new revision deletes them, so a signature always matches the text that was signed.
create table public.agreement_signatures (
  project_id uuid not null references public.projects(id) on delete cascade,
  role text not null check (role in ('contractor', 'homeowner')),
  user_id uuid not null references auth.users(id),
  typed_name text not null,
  revision int not null,
  signed_at timestamptz not null default now(),
  primary key (project_id, role)
);

create table public.change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  number int not null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  cost_cents bigint not null default 0,
  days int not null default 0,
  requested_by uuid not null references auth.users(id),
  requested_role text not null check (requested_role in ('contractor', 'homeowner')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'withdrawn')),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, number)
);

-- ---------- Helpers ----------
create or replace function public.is_contractor_side(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_members pm where pm.project_id = pid and pm.user_id = auth.uid() and pm.role = 'contractor')
      or exists (select 1 from projects p join company_members cm on cm.company_id = p.company_id
                 where p.id = pid and cm.user_id = auth.uid());
$$;

-- The homeowner sees the agreement only after the contractor sends it. Drafts stay private to the contractor side.
create or replace function public.agreement_visible(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_contractor_side(pid)
      or (public.is_project_member(pid)
          and exists (select 1 from agreements a where a.project_id = pid and a.sent_at is not null));
$$;

-- ---------- Row level security ----------
alter table public.agreements enable row level security;
alter table public.agreement_items enable row level security;
alter table public.agreement_milestones enable row level security;
alter table public.agreement_signatures enable row level security;
alter table public.change_orders enable row level security;

create policy "agreement visible" on public.agreements for select using (public.agreement_visible(project_id));
create policy "items visible" on public.agreement_items for select using (public.agreement_visible(project_id));
create policy "milestones visible" on public.agreement_milestones for select using (public.agreement_visible(project_id));
create policy "signatures visible" on public.agreement_signatures for select using (public.agreement_visible(project_id));
create policy "change orders visible" on public.change_orders for select using (public.is_project_member(project_id));

-- Writes go through the server (service role) after it checks the person's role and the agreement's state.
