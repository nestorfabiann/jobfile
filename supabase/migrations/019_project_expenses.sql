-- Contractor money tracker (019). Run once in the Supabase SQL editor. Safe to run again.
-- Private to the contractor's company. The app reads and writes it with the server key after checking the role.
create table if not exists public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents < 100000000000),
  category text not null default 'other' check (category in ('materials', 'labor', 'equipment', 'permits', 'other')),
  vendor text not null default '' check (char_length(vendor) <= 120),
  spent_on date not null default current_date,
  receipt_path text,
  created_at timestamptz not null default now()
);
create index if not exists project_expenses_project_idx on public.project_expenses (project_id, spent_on desc);
create index if not exists project_expenses_company_idx on public.project_expenses (company_id, spent_on desc);
alter table public.project_expenses enable row level security;
insert into storage.buckets (id, name, public) values ('expense-receipts', 'expense-receipts', false) on conflict (id) do nothing;
