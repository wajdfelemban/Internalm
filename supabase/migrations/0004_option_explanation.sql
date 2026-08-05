-- Per-option explanation ("why this answer is right/wrong"), shown under
-- each option after the user answers during a study session.
alter table public.question_options add column if not exists explanation text;
