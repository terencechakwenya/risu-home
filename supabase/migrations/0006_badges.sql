-- Earned badges (gamification, Pearl-facing). Awarded automatically on month
-- rollover when the household finished under total budget. Read-scoped to the
-- household; inserts happen only inside start_new_month (SECURITY DEFINER).

create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  kind text not null,           -- 'on_budget'
  label text not null,          -- 'On Budget — June 2026'
  period text not null,         -- 'June 2026'
  earned_at timestamptz default now(),
  unique (household_id, kind, period)
);

alter table badges enable row level security;
create policy badges_read on badges for select
  using (household_id = current_household_id());

-- Re-define start_new_month to also award the monthly "On Budget" badge when the
-- closing month came in at or under total budget.
create or replace function start_new_month(p_household uuid, p_new_month text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old_month text;
  v_budget numeric;
  v_spent numeric;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select month into v_old_month from households where id = p_household;

  select coalesce(sum(budget), 0), coalesce(sum(spent), 0)
    into v_budget, v_spent
    from envelopes where household_id = p_household;

  if v_spent <= v_budget then
    insert into badges (household_id, kind, label, period)
    values (p_household, 'on_budget', 'On Budget — ' || v_old_month, v_old_month)
    on conflict (household_id, kind, period) do nothing;
  end if;

  update receipts set archived = true, period = v_old_month
   where household_id = p_household and archived = false;

  update envelopes set spent = 0, updated_at = now() where household_id = p_household;

  update households
     set month = p_new_month,
         buffer = buffer + buffer_accrual
   where id = p_household;
end;
$$;
