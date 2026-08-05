-- Server-stamped updated_at (never trust client clocks for conflict
-- resolution — see sync engine's optimistic-concurrency check) and a
-- force-set owner_id on insert as defense-in-depth against a buggy or
-- tampered client sending someone else's owner_id.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.force_owner_id()
returns trigger as $$
begin
  new.owner_id = auth.uid();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'questions', 'question_options', 'question_states',
    'study_sessions', 'session_answers'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
    execute format('drop trigger if exists force_owner_id on public.%I', t);
    execute format(
      'create trigger force_owner_id before insert on public.%I for each row execute function public.force_owner_id()',
      t
    );
  end loop;
end $$;

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
