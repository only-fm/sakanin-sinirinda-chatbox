alter table public.profiles add column contact_email text;
alter table public.profiles add column email text;

revoke update on public.profiles from authenticated;
grant update (contact_email, email) on public.profiles to authenticated;

create policy "Users can update their contact email"
  on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    and (select public.current_user_role()) = 'student'
  )
  with check (
    id = (select auth.uid())
    and (select public.current_user_role()) = 'student'
  );

revoke update on public.expert_questions from authenticated;
grant update (answer, answered_by, answered_at) on public.expert_questions to authenticated;

create policy "Experts can view profiles needed for reviews"
  on public.profiles for select to authenticated
  using ((select public.current_user_role()) = 'expert');

create or replace function public.notify_experts_of_question()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (
    recipient_user_id, type, title, message, target_url, metadata
  )
  select p.id, 'expert_question', 'Yeni öğrenci sorusu',
         'Bir öğrenci uzmana soru yöneltti.',
         '/expert?question=' || new.id::text,
         jsonb_build_object('questionId', new.id, 'scenarioId', new.scenario_id)
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where p.role = 'expert' and coalesce(np.in_app_enabled, true);
  return new;
end;
$$;

create trigger expert_question_notification
  after insert on public.expert_questions
  for each row execute function public.notify_experts_of_question();

create or replace function public.notify_student_of_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.answer is null and new.answer is not null then
    insert into public.notifications (
      recipient_user_id, type, title, message, target_url, metadata
    )
    select new.student_id, 'expert_answer', 'Uzman sorunu yanıtladı',
           'Uzman soruna bir yanıt verdi.',
           '/student?view=expert&question=' || new.id::text,
           jsonb_build_object('questionId', new.id)
    where coalesce((
      select np.in_app_enabled
      from public.notification_preferences np
      where np.user_id = new.student_id
    ), true);
  end if;
  return new;
end;
$$;

create trigger expert_answer_notification
  after update of answer on public.expert_questions
  for each row execute function public.notify_student_of_answer();

create or replace function public.notify_students_of_published_scenario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.notifications (
      recipient_user_id, type, title, message, target_url, metadata
    )
    select p.id, 'scenario_published', 'Yeni senaryo yayımlandı',
           new.title,
           '/student?scenario=' || new.id::text,
           jsonb_build_object('scenarioId', new.id)
    from public.profiles p
    left join public.notification_preferences np on np.user_id = p.id
    where p.role = 'student' and coalesce(np.in_app_enabled, true);
  end if;
  return new;
end;
$$;

create trigger scenario_published_notification
  after update of status on public.scenarios
  for each row execute function public.notify_students_of_published_scenario();

create or replace function public.audit_scenario_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_name text;
  actor_role text;
  entity_id uuid;
  entity_title text;
  event_action text;
begin
  if tg_op = 'DELETE' then
    entity_id := old.id;
    entity_title := old.title;
  else
    entity_id := new.id;
    entity_title := new.title;
  end if;
  if tg_op = 'INSERT' then
    event_action := 'scenario.created';
  elsif tg_op = 'DELETE' then
    event_action := 'scenario.deleted';
  elsif old.status is distinct from new.status and new.status = 'published' then
    event_action := 'scenario.published';
  elsif old.status is distinct from new.status then
    event_action := 'scenario.unpublished';
  else
    event_action := 'scenario.updated';
  end if;

  select p.username, p.role into actor_name, actor_role
  from public.profiles p where p.id = actor_id;

  insert into public.audit_logs (
    actor_user_id, actor_username, actor_role, action, entity_type, entity_id, details
  ) values (
    actor_id, actor_name, actor_role, event_action, 'scenario', entity_id::text,
    jsonb_build_object('title', entity_title)
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_scenario_changes
  after insert or update or delete on public.scenarios
  for each row execute function public.audit_scenario_changes();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array['video/mp4', 'video/webm', 'video/ogg']
where id = 'scenario-videos';
