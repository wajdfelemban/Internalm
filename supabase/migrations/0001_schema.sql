-- Core schema for the offline-first study/spaced-repetition app.
-- Every syncable table shares the same shape: a client-generated uuid id,
-- an owner_id for RLS + sync scoping, server-stamped updated_at (see
-- 0002_triggers.sql) and a deleted_at tombstone instead of hard deletes so
-- incremental pull-sync can detect removals.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.categories (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.questions (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  prompt text not null,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.question_options (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.question_states (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'learning', 'review')),
  due_at timestamptz,
  interval_days integer not null default 0,
  ease_factor numeric not null default 2.5,
  repetitions integer not null default 0,
  lapses integer not null default 0,
  last_reviewed_at timestamptz,
  is_flagged boolean not null default false,
  is_highlighted boolean not null default false,
  notes text not null default '',
  times_seen integer not null default 0,
  times_correct integer not null default 0,
  times_wrong integer not null default 0,
  last_result text check (last_result in ('correct', 'wrong')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_id, question_id)
);

create table if not exists public.study_sessions (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  include_subcategories boolean not null default true,
  pool_filter text not null check (pool_filter in ('smart', 'all', 'unseen', 'wrong', 'flagged', 'highlighted')),
  requested_count integer not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  correct_count integer not null default 0,
  total_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.session_answers (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  selected_option_id uuid references public.question_options (id) on delete set null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists categories_owner_idx on public.categories (owner_id);
create index if not exists categories_parent_idx on public.categories (parent_id);
create index if not exists questions_owner_idx on public.questions (owner_id);
create index if not exists questions_category_idx on public.questions (category_id);
create index if not exists question_options_question_idx on public.question_options (question_id);
create index if not exists question_states_owner_idx on public.question_states (owner_id);
create index if not exists question_states_question_idx on public.question_states (question_id);
create index if not exists question_states_due_idx on public.question_states (owner_id, due_at);
create index if not exists study_sessions_owner_idx on public.study_sessions (owner_id);
create index if not exists session_answers_session_idx on public.session_answers (session_id);

-- Incremental-pull-sync watermark queries filter on (owner_id, updated_at);
-- these composite indexes keep that query cheap as tables grow.
create index if not exists categories_sync_idx on public.categories (owner_id, updated_at);
create index if not exists questions_sync_idx on public.questions (owner_id, updated_at);
create index if not exists question_options_sync_idx on public.question_options (owner_id, updated_at);
create index if not exists question_states_sync_idx on public.question_states (owner_id, updated_at);
create index if not exists study_sessions_sync_idx on public.study_sessions (owner_id, updated_at);
create index if not exists session_answers_sync_idx on public.session_answers (owner_id, updated_at);
