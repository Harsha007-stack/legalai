do $$
declare
  constraint_row record;
  allowed_statuses text;
begin
  for constraint_row in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attname = 'status'
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.consultation_requests'::regclass
      and c.contype = 'c'
      and cardinality(c.conkey) = 1
  loop
    execute format(
      'alter table public.consultation_requests drop constraint %I',
      constraint_row.conname
    );
  end loop;

  select string_agg(quote_literal(status), ', ' order by status)
  into allowed_statuses
  from (
    select unnest(array[
      'pending',
      'accepted',
      'declined',
      'counter_proposed',
      'confirmed',
      'cancelled'
    ]::text[]) as status
    union
    select distinct status
    from public.consultation_requests
    where status is not null
  ) statuses;

  execute format(
    'alter table public.consultation_requests add constraint consultation_requests_status_check check (status in (%s))',
    allowed_statuses
  );
end;
$$;

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
    if p_action = 'confirm' and request_row.status = 'counter_proposed' then
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
