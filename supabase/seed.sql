-- RISU Home — seed the locked model (spec §3). Run after 0001_init.sql.
-- Uses a fixed household id so envelopes/fixed_items reference it deterministically.
-- Members (Pearl, Terence) are created on first sign-in, not seeded here, because
-- they reference auth.users — see the note at the bottom.

insert into households (id, name, month, buffer, buffer_accrual, term_fee)
values ('00000000-0000-0000-0000-0000000000a1', 'Chakwenya', 'June 2026', 15999, 5333, 16000)
on conflict (id) do nothing;

-- Envelopes — FNB subtotal 4,800 · Stanbic subtotal 4,000.
insert into envelopes (id, household_id, name, account, budget, spent, is_weekly, is_hybrid, base, weekly_rate, weeks, sort) values
  ('groc',  '00000000-0000-0000-0000-0000000000a1', 'Groceries',         'FNB',     3200, 0, false, true,  2000, 400, 3, 0),
  ('fuel',  '00000000-0000-0000-0000-0000000000a1', 'Kids pick-up fuel', 'FNB',     1600, 0, true,  false, 0,    400, 4, 1),
  ('lunch', '00000000-0000-0000-0000-0000000000a1', 'Kids lunch',        'Stanbic', 1800, 0, true,  false, 0,    450, 4, 2),
  ('toil',  '00000000-0000-0000-0000-0000000000a1', 'Toiletries',        'Stanbic', 600,  0, false, false, 0,    0,   0, 3),
  ('trans', '00000000-0000-0000-0000-0000000000a1', 'Wife transport',    'Stanbic', 1600, 0, true,  false, 0,    400, 4, 4)
on conflict (id) do nothing;

insert into fixed_items (household_id, name, amount, sort) values
  ('00000000-0000-0000-0000-0000000000a1', 'Mom rent (net)', 1150, 0),
  ('00000000-0000-0000-0000-0000000000a1', 'Madressa',        850, 1)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- Storage: private 'receipts' bucket. Path: {household_id}/{receipt_id}.jpg
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Members of the household may read/write objects under their household folder.
create policy "receipts_read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.current_household_id()::text);
create policy "receipts_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.current_household_id()::text);

-- After Pearl and Terence sign up via Supabase Auth, link them to the household:
--   insert into members (id, household_id, display_name, role) values
--     ('<pearl-auth-uid>',   '00000000-0000-0000-0000-0000000000a1', 'Pearl',   'pearl'),
--     ('<terence-auth-uid>', '00000000-0000-0000-0000-0000000000a1', 'Terence', 'terence');
