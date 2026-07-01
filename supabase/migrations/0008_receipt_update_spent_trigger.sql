-- Keep envelopes.spent in sync when a receipt is EDITED (amount and/or which
-- envelope it belongs to). The insert trigger (0002) only bumps on capture; an
-- admin editing history changes the amount or moves the receipt to a different
-- envelope, and spent has to follow. SECURITY DEFINER for the same reason as the
-- insert trigger — the spend adjustment must not depend on the caller's direct
-- write access to envelopes.
--
-- Only fires when the amount or envelope actually changed, so unrelated updates
-- (the sync worker stamping photo_path, or start_new_month flipping `archived`)
-- never touch spent.

create or replace function bump_envelope_spent_on_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.envelope_id = old.envelope_id then
    -- Same envelope: apply the delta.
    update envelopes
       set spent = greatest(0, spent - old.amount + new.amount),
           updated_at = now()
     where id = new.envelope_id
       and household_id = new.household_id;
  else
    -- Moved envelopes: back the old one out, add to the new one.
    update envelopes
       set spent = greatest(0, spent - old.amount),
           updated_at = now()
     where id = old.envelope_id
       and household_id = old.household_id;
    update envelopes
       set spent = spent + new.amount,
           updated_at = now()
     where id = new.envelope_id
       and household_id = new.household_id;
  end if;
  return new;
end;
$$;

create trigger receipts_bump_spent_update
  after update on receipts
  for each row
  when (
    old.amount is distinct from new.amount
    or old.envelope_id is distinct from new.envelope_id
  )
  execute function bump_envelope_spent_on_update();
