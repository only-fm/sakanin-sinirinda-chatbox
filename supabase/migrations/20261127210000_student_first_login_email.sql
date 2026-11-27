alter table public.profiles
  add column if not exists is_first_login boolean not null default true,
  add column if not exists real_email text,
  add column if not exists email_verified boolean not null default false;

revoke update on public.profiles from authenticated;
grant update (contact_email, email, real_email, email_verified, is_first_login)
  on public.profiles to authenticated;
