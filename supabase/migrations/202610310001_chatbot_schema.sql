create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'citizen' check (role in ('citizen', 'advocate', 'admin')),
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  client_message_id uuid,
  created_at timestamptz not null default now(),
  constraint chat_messages_conversation_client_role_key
    unique (conversation_id, client_message_id, role)
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  title text not null default 'Untitled case' check (char_length(title) between 1 and 160),
  issue_summary text not null default '',
  category text,
  location_city text,
  location_state text,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_facts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  fact_key text not null check (char_length(fact_key) between 1 and 120),
  fact_value text not null check (char_length(fact_value) between 1 and 2000),
  source text not null check (source in ('user', 'ai_extracted')),
  confirmed_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);
create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at);
create index if not exists cases_user_updated_idx
  on public.cases (user_id, updated_at desc);
create index if not exists case_facts_case_idx
  on public.case_facts (case_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

drop trigger if exists cases_set_updated_at on public.cases;
create trigger cases_set_updated_at
before update on public.cases
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  display_name text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'citizen');
  if requested_role not in ('citizen', 'advocate') then
    requested_role := 'citizen';
  end if;

  display_name := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  if display_name is null then
    display_name := coalesce(nullif(split_part(new.email, '@', 1), ''), 'User');
  end if;

  insert into public.profiles (id, role, full_name)
  values (new.id, requested_role, display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.cases enable row level security;
alter table public.case_facts enable row level security;

revoke all on public.profiles, public.conversations, public.chat_messages, public.cases, public.case_facts from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert, update, delete on public.cases to authenticated;
grant select, insert, update, delete on public.case_facts to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists conversations_select_own on public.conversations;
create policy conversations_select_own on public.conversations
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists conversations_insert_own on public.conversations;
create policy conversations_insert_own on public.conversations
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists conversations_update_own on public.conversations;
create policy conversations_update_own on public.conversations
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists conversations_delete_own on public.conversations;
create policy conversations_delete_own on public.conversations
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists chat_messages_select_own on public.chat_messages;
create policy chat_messages_select_own on public.chat_messages
for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = chat_messages.conversation_id
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists chat_messages_insert_user_only on public.chat_messages;
create policy chat_messages_insert_user_only on public.chat_messages
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'user'
  and exists (
    select 1 from public.conversations c
    where c.id = chat_messages.conversation_id
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists cases_select_own on public.cases;
create policy cases_select_own on public.cases
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists cases_insert_own on public.cases;
create policy cases_insert_own on public.cases
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    conversation_id is null
    or exists (
      select 1 from public.conversations c
      where c.id = cases.conversation_id
        and c.user_id = (select auth.uid())
    )
  )
);

drop policy if exists cases_update_own on public.cases;
create policy cases_update_own on public.cases
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    conversation_id is null
    or exists (
      select 1 from public.conversations c
      where c.id = cases.conversation_id
        and c.user_id = (select auth.uid())
    )
  )
);

drop policy if exists cases_delete_own on public.cases;
create policy cases_delete_own on public.cases
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists case_facts_select_own on public.case_facts;
create policy case_facts_select_own on public.case_facts
for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.cases c
    where c.id = case_facts.case_id
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists case_facts_insert_own on public.case_facts;
create policy case_facts_insert_own on public.case_facts
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.cases c
    where c.id = case_facts.case_id
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists case_facts_update_own on public.case_facts;
create policy case_facts_update_own on public.case_facts
for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.cases c
    where c.id = case_facts.case_id
      and c.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.cases c
    where c.id = case_facts.case_id
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists case_facts_delete_own on public.case_facts;
create policy case_facts_delete_own on public.case_facts
for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.cases c
    where c.id = case_facts.case_id
      and c.user_id = (select auth.uid())
  )
);

create or replace function public.append_assistant_message(
  p_user_id uuid,
  p_conversation_id uuid,
  p_content text,
  p_metadata jsonb default '{}'::jsonb,
  p_client_message_id uuid default null
)
returns setof public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_message public.chat_messages;
  owner_id uuid;
begin
  if p_user_id is null then
    raise exception 'User ID required' using errcode = '22023';
  end if;

  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'User is not authorized' using errcode = '42501';
  end if;

  select c.user_id into owner_id
  from public.conversations c
  where c.id = p_conversation_id;

  if owner_id is null or owner_id <> p_user_id then
    raise exception 'Conversation not found' using errcode = '42501';
  end if;

  if p_content is null or char_length(p_content) not between 1 and 12000 then
    raise exception 'Invalid assistant message content' using errcode = '22023';
  end if;

  insert into public.chat_messages (
    conversation_id, user_id, role, content, metadata, client_message_id
  )
  values (
    p_conversation_id,
    p_user_id,
    'assistant',
    p_content,
    coalesce(p_metadata, '{}'::jsonb),
    p_client_message_id
  )
  on conflict (conversation_id, client_message_id, role) do nothing;

  select m.* into inserted_message
  from public.chat_messages m
  where m.conversation_id = p_conversation_id
    and m.role = 'assistant'
    and (
      (p_client_message_id is not null and m.client_message_id = p_client_message_id)
      or (p_client_message_id is null and m.created_at = (
        select max(latest.created_at)
        from public.chat_messages latest
        where latest.conversation_id = p_conversation_id
          and latest.role = 'assistant'
      ))
    )
  order by m.created_at desc
  limit 1;

  return next inserted_message;
end;
$$;

revoke all on function public.append_assistant_message(uuid, uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.append_assistant_message(uuid, uuid, text, jsonb, uuid) to authenticated;
