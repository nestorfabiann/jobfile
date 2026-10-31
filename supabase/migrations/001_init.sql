-- Jobfile phase 1: accounts, companies, projects, messages, notifications.
-- Run in the Supabase SQL editor, or with `supabase db push`.

create extension if not exists pgcrypto;

-- One profile per login. Created automatically when someone first signs in.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  notify_email boolean not null default true,
  notify_sms boolean not null default false,
  sms_consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  primary key (company_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address text not null default '',
  homeowner_name text not null default '',
  homeowner_email text not null,
  -- Texas: homestead jobs have extra contract rules (written contract before work, spouse signature, filing).
  is_homestead boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('contractor', 'homeowner')),
  primary key (project_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  sender_role text not null check (sender_role in ('contractor', 'homeowner')),
  tag text check (tag in ('update', 'question', 'decision')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_project_created on public.messages (project_id, created_at);

-- In-app record of every alert, plus what happened when we tried to email or text it.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  email_sent_at timestamptz,
  sms_sent_at timestamptz,
  error text
);
create index notifications_user_created on public.notifications (user_id, created_at desc);

-- ---------- Helpers ----------

-- True when the signed-in user belongs to the project directly, or works for the company that owns it.
create or replace function public.is_project_member(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_members pm where pm.project_id = pid and pm.user_id = auth.uid())
      or exists (select 1 from projects p join company_members cm on cm.company_id = p.company_id
                 where p.id = pid and cm.user_id = auth.uid());
$$;

create or replace function public.is_company_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from company_members cm where cm.company_id = cid and cm.user_id = auth.uid());
$$;

-- New login: create a profile and attach any projects that were opened for this email address.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, lower(new.email));
  insert into project_members (project_id, user_id, role)
    select p.id, new.id, 'homeowner' from projects p where lower(p.homeowner_email) = lower(new.email)
    on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row level security ----------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

create policy "own profile" on public.profiles for select using (id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "company visible to members" on public.companies for select using (public.is_company_member(id));
create policy "own company memberships" on public.company_members for select using (user_id = auth.uid());

create policy "projects visible to members" on public.projects for select using (public.is_project_member(id));
create policy "project members visible to members" on public.project_members for select using (public.is_project_member(project_id));

create policy "messages visible to members" on public.messages for select using (public.is_project_member(project_id));
create policy "members post their own messages" on public.messages for insert
  with check (sender_id = auth.uid() and public.is_project_member(project_id));

create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Writes to companies, projects, memberships and notifications go through the server
-- (service role key) after the server checks who is asking. No client insert policies exist for them.
