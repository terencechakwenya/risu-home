-- Archive receipts on month rollover instead of deleting them, so prior months
-- stay retrievable for Hope's books and the photos aren't orphaned in Storage.
-- `archived` excludes them from the current month; `period` records which month
-- they belonged to.

alter table receipts add column if not exists archived boolean not null default false;
alter table receipts add column if not exists period text;

create index if not exists receipts_period_idx on receipts (household_id, period);

-- Start a new month: archive (not delete) the closing month's receipts, zero
-- envelope spend, roll the month label forward and accrue the buffer.
create or replace function start_new_month(p_household uuid, p_new_month text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old_month text;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select month into v_old_month from households where id = p_household;

  update receipts
     set archived = true,
         period = v_old_month
   where household_id = p_household
     and archived = false;

  update envelopes set spent = 0, updated_at = now() where household_id = p_household;

  update households
     set month = p_new_month,
         buffer = buffer + buffer_accrual
   where id = p_household;
end;
$$;
