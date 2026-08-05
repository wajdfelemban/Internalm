-- New study-setup pool filters: "due" (previously-seen and due, excluding
-- brand-new questions) and "mastered" (long review interval — see
-- MASTERED_INTERVAL_DAYS in src/lib/srs.ts).
alter table public.study_sessions drop constraint if exists study_sessions_pool_filter_check;
alter table public.study_sessions add constraint study_sessions_pool_filter_check
  check (pool_filter in ('smart', 'due', 'all', 'unseen', 'wrong', 'flagged', 'highlighted', 'mastered'));
