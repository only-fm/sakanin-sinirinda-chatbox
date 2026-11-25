create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  role text not null default 'student' check (role in ('student', 'expert', 'admin')),
  tutorial_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scenario_text text not null,
  context_text text not null default '',
  video_url text,
  video_path text,
  perspectives jsonb not null default '[]'::jsonb,
  reflection_questions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index scenarios_status_created_at_idx on public.scenarios (status, created_at desc);

create table public.student_scenario_responses (
  student_id uuid not null references public.profiles (id) on delete cascade,
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  classification text check (classification in ('joke', 'bullying')),
  reasoning text,
  updated_at timestamptz not null default now(),
  primary key (student_id, scenario_id)
);

create table public.expert_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  scenario_id uuid references public.scenarios (id) on delete set null,
  question text not null,
  answer text,
  answered_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index expert_questions_created_at_idx on public.expert_questions (created_at desc);

create table public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reporter_role text not null check (reporter_role in ('student', 'expert')),
  screen text not null,
  description text not null,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index problem_reports_created_at_idx on public.problem_reports (created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_username text,
  actor_role text check (actor_role in ('student', 'expert', 'admin')),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  recipient_device_id uuid,
  type text not null,
  title text not null,
  message text not null,
  target_url text,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (recipient_user_id, created_at desc) where is_read = false;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  in_app_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
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
begin
  requested_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1)),
    '[^a-zA-Z0-9._-]', '', 'g'
  ));
  if requested_username = '' then
    requested_username := 'user-' || left(replace(new.id::text, '-', ''), 8);
  end if;

  insert into public.profiles (id, username, role)
  values (new.id, requested_username || '-' || left(replace(new.id::text, '-', ''), 6), 'student');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_auth_user();

create or replace function public.complete_user_tutorial()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set tutorial_completed = true where id = (select auth.uid())
$$;
revoke all on function public.complete_user_tutorial() from public;
grant execute on function public.complete_user_tutorial() to authenticated;

alter table public.profiles enable row level security;
alter table public.scenarios enable row level security;
alter table public.student_scenario_responses enable row level security;
alter table public.expert_questions enable row level security;
alter table public.problem_reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

create policy "Profiles are visible to their owner and admins"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.current_user_role()) = 'admin');

create policy "Admins can update profiles"
  on public.profiles for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "Published scenarios are visible to authenticated users"
  on public.scenarios for select to authenticated
  using (
    status = 'published'
    or (select public.current_user_role()) in ('expert', 'admin')
  );
create policy "Admins can create scenarios"
  on public.scenarios for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');
create policy "Admins can update scenarios"
  on public.scenarios for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
create policy "Admins can delete scenarios"
  on public.scenarios for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

create policy "Students can read their responses; experts can review"
  on public.student_scenario_responses for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select public.current_user_role()) in ('expert', 'admin')
  );
create policy "Students can create their own responses"
  on public.student_scenario_responses for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and (select public.current_user_role()) = 'student'
  );
create policy "Students can update their own responses"
  on public.student_scenario_responses for update to authenticated
  using (
    student_id = (select auth.uid())
    and (select public.current_user_role()) = 'student'
  )
  with check (
    student_id = (select auth.uid())
    and (select public.current_user_role()) = 'student'
  );

create policy "Question owners and experts can read questions"
  on public.expert_questions for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select public.current_user_role()) in ('expert', 'admin')
  );
create policy "Students can ask questions"
  on public.expert_questions for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and (select public.current_user_role()) = 'student'
  );
create policy "Experts can answer questions"
  on public.expert_questions for update to authenticated
  using ((select public.current_user_role()) in ('expert', 'admin'))
  with check ((select public.current_user_role()) in ('expert', 'admin'));

create policy "Report owners and admins can read reports"
  on public.problem_reports for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );
create policy "Students and experts can submit their reports"
  on public.problem_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and reporter_role = (select public.current_user_role())
    and reporter_role in ('student', 'expert')
  );
create policy "Admins can resolve reports"
  on public.problem_reports for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "Admins can read audit logs"
  on public.audit_logs for select to authenticated
  using ((select public.current_user_role()) = 'admin');

create policy "Users can read their notifications"
  on public.notifications for select to authenticated
  using (recipient_user_id = (select auth.uid()));
create policy "Users can update their notifications"
  on public.notifications for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));
create policy "Users can delete their notifications"
  on public.notifications for delete to authenticated
  using (recipient_user_id = (select auth.uid()));

create policy "Users can manage their push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can read their notification preferences"
  on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can manage their notification preferences"
  on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public)
values ('scenario-videos', 'scenario-videos', false)
on conflict (id) do nothing;

create policy "Authenticated users can view published scenario videos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'scenario-videos'
    and (
      (select public.current_user_role()) in ('expert', 'admin')
      or exists (
        select 1 from public.scenarios s
        where s.id::text = (storage.foldername(name))[1]
          and s.status = 'published'
      )
    )
  );
create policy "Admins can manage scenario videos"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'scenario-videos'
    and (select public.current_user_role()) = 'admin'
  )
  with check (
    bucket_id = 'scenario-videos'
    and (select public.current_user_role()) = 'admin'
  );
