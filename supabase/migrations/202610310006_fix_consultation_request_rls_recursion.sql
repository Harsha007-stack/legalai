create or replace function public.can_create_consultation_request(p_advocate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles c
    where c.id = (select auth.uid())
      and c.role = 'citizen'
  )
  and exists (
    select 1
    from public.profiles a
    join public.advocate_profiles ap on ap.advocate_id = a.id
    where a.id = p_advocate_id
      and a.role = 'advocate'
      and ap.is_published
  );
$$;

revoke all on function public.can_create_consultation_request(uuid) from public, anon;
grant execute on function public.can_create_consultation_request(uuid) to authenticated;

drop policy if exists consultation_requests_insert_citizen on public.consultation_requests;
create policy consultation_requests_insert_citizen on public.consultation_requests
for insert to authenticated
with check (
  citizen_id = (select auth.uid())
  and status = 'pending'
  and public.can_create_consultation_request(advocate_id)
);
