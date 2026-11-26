begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  role text not null default 'student'
    check (role in ('student', 'expert', 'admin')),
  email text,
  tutorial_completed boolean not null default false,
  contact_email text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists tutorial_completed boolean not null default false,
  add column if not exists contact_email text,
  add column if not exists email text,
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles
  alter column username set not null,
  alter column role set default 'student',
  alter column role set not null;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('student', 'expert', 'admin'));
  end if;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  username_suffix text;
begin
  requested_username := left(lower(regexp_replace(
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    '[^a-zA-Z0-9._-]', '', 'g'
  )), 32);

  if requested_username = '' then
    requested_username := 'user';
  end if;

  username_suffix := left(replace(new.id::text, '-', ''), 8);

  insert into public.profiles (id, username, role)
  values (new.id, requested_username, 'student')
  on conflict do nothing;

  if not exists (
    select 1 from public.profiles p where p.id = new.id
  ) then
    insert into public.profiles (id, username, role)
    values (new.id, left(requested_username, 23) || '-' || username_suffix, 'student')
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_auth_user();

alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (contact_email, email) on public.profiles to authenticated;

drop policy if exists "Profiles are visible to their owner and admins" on public.profiles;
create policy "Profiles are visible to their owner and admins"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.current_user_role()) = 'admin');

drop policy if exists "Experts can view profiles needed for reviews" on public.profiles;
create policy "Experts can view profiles needed for reviews"
  on public.profiles for select to authenticated
  using ((select public.current_user_role()) = 'expert');

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "Users can update their contact email" on public.profiles;
drop policy if exists "Students can update their profile email" on public.profiles;
create policy "Students can update their profile email"
  on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    and (select public.current_user_role()) = 'student'
  )
  with check (
    id = (select auth.uid())
    and (select public.current_user_role()) = 'student'
  );

commit;
