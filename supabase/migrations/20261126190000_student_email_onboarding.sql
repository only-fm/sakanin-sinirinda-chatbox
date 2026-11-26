alter table public.profiles
  add column if not exists email text;

revoke update on public.profiles from authenticated;
grant update (contact_email, email) on public.profiles to authenticated;

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
