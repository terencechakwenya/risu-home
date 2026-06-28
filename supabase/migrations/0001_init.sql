-- RISU Home — initial schema + RLS (spec §3).
-- Run in the Supabase SQL editor (or `supabase db push`).

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Chakwenya',
  month text not null default 'June 2026',
  buffer numeric not null default 15999,        -- school-fee buffer balance
  buffer_accrual numeric not null default 5333, -- added on month rollover
  term_fee numeric not null default 16000       -- drawn when term paid
);

create table members (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references households(id),
  display_name text,
  role text check (role in ('pearl','terence')),  -- 'terence' = admin
  training_mode boolean default true,
  tours_seen jsonb default '[]'::jsonb             -- per-user trainer completion
);

create table envelopes (
  id text primary key,                  -- 'groc','lunch',...
  household_id uuid references households(id),
  name text not null,
  account text not null default 'FNB',  -- 'FNB' | 'Stanbic'
  budget numeric not null,
  spent numeric not null default 0,
  is_weekly boolean default false,
  is_hybrid boolean default false,
  base numeric default 0,               -- hybrid month-end base
  weekly_rate numeric default 0,
  weeks int default 0,
  sort int default 0,
  updated_at timestamptz default now()
);

create table fixed_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  name text not null,
  amount numeric not null,
  sort int default 0
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  envelope_id text references envelopes(id),
  amount numeric not null,
  note text,
  photo_path text,                      -- Supabase Storage path, null until synced
  logged_by text,                       -- 'pearl' | 'terence'
  created_at timestamptz default now(),
  client_id text unique                 -- de-dupe key from the device outbox
);

-- ─────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────

-- The household the current auth user belongs to.
create or replace function current_household_id()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from members where id = auth.uid()
$$;

-- True when the current user is the admin (Terence).
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from members where id = auth.uid() and role = 'terence')
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — every table scoped to the member's household.
-- Reads: both members. Writes/manage: Terence only, except receipts (both insert).
-- ─────────────────────────────────────────────────────────────────────────

alter table households  enable row level security;
alter table members     enable row level security;
alter table envelopes   enable row level security;
alter table fixed_items enable row level security;
alter table receipts    enable row level security;

-- households
create policy households_read on households for select
  using (id = current_household_id());
create policy households_write on households for update
  using (id = current_household_id() and is_admin());

-- members: a user can read members of their household; only admin manages roles.
create policy members_read on members for select
  using (household_id = current_household_id());
create policy members_self_upsert on members for insert
  with check (id = auth.uid());
create policy members_self_update on members for update
  using (id = auth.uid());

-- envelopes
create policy envelopes_read on envelopes for select
  using (household_id = current_household_id());
create policy envelopes_insert on envelopes for insert
  with check (household_id = current_household_id() and is_admin());
create policy envelopes_update on envelopes for update
  using (household_id = current_household_id() and is_admin());
create policy envelopes_delete on envelopes for delete
  using (household_id = current_household_id() and is_admin());

-- fixed_items (manage = admin)
create policy fixed_read on fixed_items for select
  using (household_id = current_household_id());
create policy fixed_insert on fixed_items for insert
  with check (household_id = current_household_id() and is_admin());
create policy fixed_update on fixed_items for update
  using (household_id = current_household_id() and is_admin());
create policy fixed_delete on fixed_items for delete
  using (household_id = current_household_id() and is_admin());

-- receipts: both members read and insert; nobody edits history except admin.
create policy receipts_read on receipts for select
  using (household_id = current_household_id());
create policy receipts_insert on receipts for insert
  with check (household_id = current_household_id());
create policy receipts_update on receipts for update
  using (household_id = current_household_id() and is_admin());
