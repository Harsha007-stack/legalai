drop policy if exists consultation_documents_insert_participant
  on public.consultation_documents;
create policy consultation_documents_insert_participant
on public.consultation_documents
for insert to authenticated
with check (
  uploader_id = (select auth.uid())
  and public.is_consultation_participant(request_id)
  and exists (
    select 1
    from public.consultation_requests r
    where r.id = request_id
      and r.status in ('pending', 'accepted', 'confirmed')
  )
);

drop policy if exists consultation_files_insert_participant
  on storage.objects;
create policy consultation_files_insert_participant
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'consultation-documents'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1
    from public.consultation_requests r
    where r.id::text = split_part(name, '/', 1)
      and (r.citizen_id = (select auth.uid()) or r.advocate_id = (select auth.uid()))
      and r.status in ('pending', 'accepted', 'confirmed')
  )
);
