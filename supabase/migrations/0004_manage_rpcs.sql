-- Admin actions that must be atomic / server-computed, exposed as RPCs the sync
-- worker can call from the outbox. Both guard on is_admin() (Terence only) and
-- run SECURITY DEFINER so the multi-row writes aren't blocked piecemeal by RLS.

-- Draw a term fee from the school buffer (never below zero).
create or replace function record_term_fee(p_household uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update households
     set buffer = greatest(0, buffer - term_fee)
   where id = p_household;
end;
$$;

-- Start a new month: zero all envelope spend, clear the month's receipts, roll
-- the month label forward and accrue the buffer. The new month label is computed
-- client-side (nextMonth) and passed in.
create or replace function start_new_month(p_household uuid, p_new_month text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update envelopes set spent = 0, updated_at = now() where household_id = p_household;
  delete from receipts where household_id = p_household;
  update households
     set month = p_new_month,
         buffer = buffer + buffer_accrual
   where id = p_household;
end;
$$;
