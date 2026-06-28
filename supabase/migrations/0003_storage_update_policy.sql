-- Allow members to overwrite their own household's receipt objects. The sync
-- worker uploads photos with upsert=true; a retry after a partial offline flush
-- updates an existing object, which needs UPDATE in addition to INSERT/SELECT.

create policy "receipts_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );
