-- Keep envelopes.spent in sync when receipts are inserted.
-- SECURITY DEFINER so it runs regardless of who inserts the receipt — Pearl
-- can insert receipts but RLS blocks her from updating envelopes directly,
-- so the spent bump must happen in a definer-owned trigger.

create or replace function bump_envelope_spent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update envelopes
     set spent = spent + new.amount,
         updated_at = now()
   where id = new.envelope_id
     and household_id = new.household_id;
  return new;
end;
$$;

create trigger receipts_bump_spent
  after insert on receipts
  for each row execute function bump_envelope_spent();
