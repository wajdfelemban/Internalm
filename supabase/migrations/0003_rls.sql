-- Row Level Security: every user can only ever read/write their own rows.
-- Policies cover ALL operations (select/insert/update/delete) — a common
-- trap is adding only a select policy and having push-sync writes fail
-- with an opaque 401/403.

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_states enable row level security;
alter table public.study_sessions enable row level security;
alter table public.session_answers enable row level security;

create policy "own profile" on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

create policy "own categories" on public.categories for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own questions" on public.questions for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own question_options" on public.question_options for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own question_states" on public.question_states for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own study_sessions" on public.study_sessions for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own session_answers" on public.session_answers for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
