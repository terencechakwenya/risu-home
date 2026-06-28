-- Undo a just-saved receipt by its client_id: reverse the envelope spend and
-- delete the row. SECURITY DEFINER but scoped to the caller's household, so a
-- user can only undo a capture in their own household. Used by the brief
-- "Saved · Undo" affordance after a synced save.

create or replace function undo_receipt(p_client_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r receipts%rowtype;
begin
  select * into r from receipts
   where client_id = p_client_id
     and household_id = current_household_id();
  if not found then
    return; -- never synced (or already undone) — nothing to reverse server-side
  end if;

  update envelopes
     set spent = greatest(0, spent - r.amount), updated_at = now()
   where id = r.envelope_id and household_id = r.household_id;

  delete from receipts where id = r.id;
end;
$$;
