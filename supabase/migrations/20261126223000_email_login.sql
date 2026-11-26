create unique index if not exists profiles_email_lower_unique_idx
  on public.profiles (lower(email))
  where email is not null and btrim(email) <> '';
