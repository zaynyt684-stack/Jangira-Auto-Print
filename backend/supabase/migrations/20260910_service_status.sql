-- Global manual ON/OFF state for the customer print portal.
create table if not exists public.service_status (
  id integer primary key check (id = 1),
  online boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.service_status (id, online)
values (1, false)
on conflict (id) do nothing;

alter table public.service_status enable row level security;

-- The Worker uses the Supabase service-role key, so it can read/write this row.
-- No public client policy is created intentionally.
