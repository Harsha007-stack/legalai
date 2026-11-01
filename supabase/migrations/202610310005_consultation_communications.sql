create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles (id) on delete cascade,
  advocate_id uuid not null references public.profiles (id) on delete cascade,
  case_title text not null check (char_length(trim(case_title)) between 1 and 160),
  case_summary text not null check (char_length(trim(case_summary)) between 10 and 12000),
  requested_time timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'counter_proposed', 'confirmed', 'cancelled')),
  proposed_fee integer check (proposed_fee is null or proposed_fee >= 0),
  proposed_time timestamptz,
  proposal_by uuid references public.profiles (id) on delete set null,
  citizen_hidden boolean not null default false,
  advocate_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (citizen_id <> advocate_id)
);

create index if not exists consultation_requests_citizen_created_idx
  on public.consultation_requests (citizen_id, created_at desc)
  where citizen_hidden = false;
create index if not exists consultation_requests_advocate_created_idx
  on public.consultation_requests (advocate_id, created_at desc)
  where advocate_hidden = false;

drop trigger if exists consultation_requests_set_updated_at on public.consultation_requests;
create trigger consultation_requests_set_updated_at
before update on public.consultation_requests
for each row execute function public.set_updated_at();

create or replace function public.is_consultation_participant(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.consultation_requests r
    where r.id = p_request_id
      and (r.citizen_id = (select auth.uid()) or r.advocate_id = (select auth.uid()))
  );
$$;

revoke all on function public.is_consultation_participant(uuid) from public, anon;
grant execute on function public.is_consultation_participant(uuid) to authenticated;

alter table public.consultation_requests enable row level security;
revoke all on public.consultation_requests from anon, authenticated;
grant select, insert on public.consultation_requests to authenticated;

drop policy if exists consultation_requests_select_participant on public.consultation_requests;
create policy consultation_requests_select_participant on public.consultation_requests
for select to authenticated
using (
  (citizen_id = (select auth.uid()) and not citizen_hidden)
  or (advocate_id = (select auth.uid()) and not advocate_hidden)
);

drop policy if exists profiles_select_consultation_participants on public.profiles;
create policy profiles_select_consultation_participants on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.consultation_requests r
    where (r.citizen_id = (select auth.uid()) and r.advocate_id = profiles.id)
       or (r.advocate_id = (select auth.uid()) and r.citizen_id = profiles.id)
  )
);

drop policy if exists consultation_requests_insert_citizen on public.consultation_requests;
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

create policy consultation_requests_insert_citizen on public.consultation_requests
for insert to authenticated
with check (
  citizen_id = (select auth.uid())
  and status = 'pending'
  and public.can_create_consultation_request(advocate_id)
);

drop policy if exists consultation_requests_update_participant on public.consultation_requests;

create or replace function public.respond_to_consultation_request(
  p_request_id uuid,
  p_action text,
  p_proposed_fee integer default null,
  p_proposed_time timestamptz default null
)
returns public.consultation_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.consultation_requests;
begin
  select * into request_row
  from public.consultation_requests
  where id = p_request_id
  for update;

  if request_row.id is null then
    raise exception 'Consultation request not found' using errcode = 'P0002';
  end if;

  if request_row.advocate_id = (select auth.uid()) then
    if request_row.status <> 'pending'
      or p_action not in ('accept', 'decline', 'counter_propose') then
      raise exception 'This request can no longer be changed by the advocate' using errcode = '42501';
    end if;
    if p_proposed_fee is not null and p_proposed_fee < 0 then
      raise exception 'Proposed fee cannot be negative' using errcode = '22023';
    end if;
    update public.consultation_requests
    set status = case
          when p_action = 'counter_propose' then 'counter_proposed'
          when p_action = 'accept' then 'accepted'
          when p_action = 'decline' then 'declined'
          else p_action
        end,
        proposed_fee = case when p_action = 'counter_propose' then p_proposed_fee else proposed_fee end,
        proposed_time = case when p_action = 'counter_propose' then p_proposed_time else proposed_time end,
        proposal_by = case when p_action = 'counter_propose' then (select auth.uid()) else proposal_by end
    where id = p_request_id
    returning * into request_row;
  elsif request_row.citizen_id = (select auth.uid()) then
    if (p_action = 'confirm' and request_row.status = 'counter_proposed') then
      update public.consultation_requests
      set status = 'confirmed'
      where id = p_request_id
      returning * into request_row;
    elsif p_action = 'cancel' and request_row.status in ('pending', 'accepted', 'counter_proposed') then
      update public.consultation_requests
      set status = 'cancelled'
      where id = p_request_id
      returning * into request_row;
    else
      raise exception 'This request can no longer be changed by the client' using errcode = '42501';
    end if;
  else
    raise exception 'Not a participant in this request' using errcode = '42501';
  end if;

  return request_row;
end;
$$;

revoke all on function public.respond_to_consultation_request(uuid, text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.respond_to_consultation_request(uuid, text, integer, timestamptz)
  to authenticated;

create or replace function public.archive_consultation_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.consultation_requests
  set citizen_hidden = case when citizen_id = (select auth.uid()) then true else citizen_hidden end,
      advocate_hidden = case when advocate_id = (select auth.uid()) then true else advocate_hidden end
  where id = p_request_id
    and (citizen_id = (select auth.uid()) or advocate_id = (select auth.uid()));
  if not found then
    raise exception 'Consultation request not found or not owned by this account' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.archive_consultation_request(uuid) from public, anon, authenticated;
grant execute on function public.archive_consultation_request(uuid) to authenticated;

create table if not exists public.consultation_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 12000),
  created_at timestamptz not null default now()
);

create index if not exists consultation_messages_request_created_idx
  on public.consultation_messages (request_id, created_at);

alter table public.consultation_messages enable row level security;
revoke all on public.consultation_messages from anon, authenticated;
grant select, insert on public.consultation_messages to authenticated;

drop policy if exists consultation_messages_select_participant on public.consultation_messages;
create policy consultation_messages_select_participant on public.consultation_messages
for select to authenticated
using (public.is_consultation_participant(request_id));

drop policy if exists consultation_messages_insert_participant on public.consultation_messages;
create policy consultation_messages_insert_participant on public.consultation_messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.is_consultation_participant(request_id)
  and exists (
    select 1
    from public.consultation_requests r
    where r.id = request_id and r.status in ('pending', 'accepted', 'confirmed')
  )
);

create table if not exists public.consultation_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 15728640),
  created_at timestamptz not null default now(),
  check (storage_path like request_id::text || '/' || uploader_id::text || '/%')
);

create index if not exists consultation_documents_request_created_idx
  on public.consultation_documents (request_id, created_at);

alter table public.consultation_documents enable row level security;
revoke all on public.consultation_documents from anon, authenticated;
grant select, insert, delete on public.consultation_documents to authenticated;

drop policy if exists consultation_documents_select_participant on public.consultation_documents;
create policy consultation_documents_select_participant on public.consultation_documents
for select to authenticated
using (public.is_consultation_participant(request_id));

drop policy if exists consultation_documents_insert_participant on public.consultation_documents;
create policy consultation_documents_insert_participant on public.consultation_documents
for insert to authenticated
with check (
  uploader_id = (select auth.uid())
  and public.is_consultation_participant(request_id)
  and exists (
    select 1 from public.consultation_requests r
    where r.id = request_id and r.status in ('accepted', 'confirmed')
  )
);

drop policy if exists consultation_documents_delete_uploader on public.consultation_documents;
create policy consultation_documents_delete_uploader on public.consultation_documents
for delete to authenticated
using (uploader_id = (select auth.uid()));

create table if not exists public.consultation_calls (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  started_by uuid not null references public.profiles (id) on delete cascade,
  call_type text not null check (call_type in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'active', 'ended', 'declined')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists consultation_calls_request_created_idx
  on public.consultation_calls (request_id, created_at desc);
create unique index if not exists consultation_calls_one_active_per_request_idx
  on public.consultation_calls (request_id)
  where status in ('ringing', 'active');

alter table public.consultation_calls enable row level security;
revoke all on public.consultation_calls from anon, authenticated;
grant select, insert on public.consultation_calls to authenticated;

drop policy if exists consultation_calls_select_participant on public.consultation_calls;
create policy consultation_calls_select_participant on public.consultation_calls
for select to authenticated
using (public.is_consultation_participant(request_id));

drop policy if exists consultation_calls_insert_participant on public.consultation_calls;
create policy consultation_calls_insert_participant on public.consultation_calls
for insert to authenticated
with check (
  started_by = (select auth.uid())
  and public.is_consultation_participant(request_id)
  and exists (
    select 1 from public.consultation_requests r
    where r.id = request_id and r.status in ('accepted', 'confirmed')
  )
);

drop policy if exists consultation_calls_update_participant on public.consultation_calls;

create or replace function public.set_consultation_call_status(p_call_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  call_row public.consultation_calls;
begin
  select * into call_row
  from public.consultation_calls
  where id = p_call_id
  for update;

  if call_row.id is null or not public.is_consultation_participant(call_row.request_id) then
    raise exception 'Call not found or not available to this account' using errcode = '42501';
  end if;
  if (p_status = 'active' and call_row.status = 'ringing')
    or (p_status in ('ended', 'declined') and call_row.status in ('ringing', 'active')) then
    update public.consultation_calls
    set status = p_status,
        ended_at = case when p_status in ('ended', 'declined') then now() else null end
    where id = p_call_id;
  else
    raise exception 'Invalid call status transition' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_consultation_call_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_consultation_call_status(uuid, text) to authenticated;

create table if not exists public.consultation_call_signals (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.consultation_calls (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice', 'end')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists consultation_call_signals_call_id_idx
  on public.consultation_call_signals (call_id, id);

alter table public.consultation_call_signals enable row level security;
revoke all on public.consultation_call_signals from anon, authenticated;
grant select, insert on public.consultation_call_signals to authenticated;

drop policy if exists consultation_call_signals_select_participant on public.consultation_call_signals;
create policy consultation_call_signals_select_participant on public.consultation_call_signals
for select to authenticated
using (
  exists (
    select 1 from public.consultation_calls c
    where c.id = call_id and public.is_consultation_participant(c.request_id)
  )
);

drop policy if exists consultation_call_signals_insert_sender on public.consultation_call_signals;
create policy consultation_call_signals_insert_sender on public.consultation_call_signals
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.consultation_calls c
    where c.id = call_id
      and c.status in ('ringing', 'active')
      and public.is_consultation_participant(c.request_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consultation-documents',
  'consultation-documents',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists consultation_files_select_participant on storage.objects;
create policy consultation_files_select_participant on storage.objects
for select to authenticated
using (
  bucket_id = 'consultation-documents'
  and exists (
    select 1 from public.consultation_requests r
    where r.id::text = split_part(name, '/', 1)
      and (r.citizen_id = (select auth.uid()) or r.advocate_id = (select auth.uid()))
  )
);

drop policy if exists consultation_files_insert_participant on storage.objects;
create policy consultation_files_insert_participant on storage.objects
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

drop policy if exists consultation_files_delete_uploader on storage.objects;
create policy consultation_files_delete_uploader on storage.objects
for delete to authenticated
using (
  bucket_id = 'consultation-documents'
  and split_part(name, '/', 2) = (select auth.uid())::text
);

alter table public.consultation_messages replica identity full;
alter table public.consultation_requests replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.consultation_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  $$;

  do $$
  begin
    alter publication supabase_realtime add table public.consultation_requests;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  $$;

  do $$
  begin
    alter publication supabase_realtime add table public.consultation_documents;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  $$;
