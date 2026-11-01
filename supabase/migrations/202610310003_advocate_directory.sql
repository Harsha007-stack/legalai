create table if not exists public.advocate_profiles (
  advocate_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  bio text not null check (char_length(trim(bio)) between 1 and 2000),
  practice_areas text[] not null check (cardinality(practice_areas) between 1 and 12),
  jurisdictions text[] not null check (cardinality(jurisdictions) between 1 and 12),
  city text not null check (char_length(trim(city)) between 1 and 120),
  state text not null check (char_length(trim(state)) between 1 and 120),
  years_experience smallint not null check (years_experience between 0 and 60),
  languages text[] not null check (cardinality(languages) between 1 and 12),
  remote_available boolean not null default false,
  consultation_fee_min integer not null check (consultation_fee_min >= 0),
  consultation_fee_max integer not null check (consultation_fee_max >= consultation_fee_min),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advocate_profiles_published_location_idx
  on public.advocate_profiles (is_published, state, city);

drop trigger if exists advocate_profiles_set_updated_at on public.advocate_profiles;
create trigger advocate_profiles_set_updated_at
before update on public.advocate_profiles
for each row execute function public.set_updated_at();

alter table public.advocate_profiles enable row level security;
revoke all on public.advocate_profiles from anon, authenticated;
grant select, insert, update on public.advocate_profiles to authenticated;

drop policy if exists advocate_profiles_select_published_or_own on public.advocate_profiles;
create policy advocate_profiles_select_published_or_own on public.advocate_profiles
for select to authenticated
using (
  is_published
  or advocate_id = (select auth.uid())
);

drop policy if exists advocate_profiles_insert_own on public.advocate_profiles;
create policy advocate_profiles_insert_own on public.advocate_profiles
for insert to authenticated
with check (
  advocate_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'advocate'
  )
);

drop policy if exists advocate_profiles_update_own on public.advocate_profiles;
create policy advocate_profiles_update_own on public.advocate_profiles
for update to authenticated
using (
  advocate_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'advocate'
  )
)
with check (
  advocate_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'advocate'
  )
);
