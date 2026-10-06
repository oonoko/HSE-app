-- Training quizzes: attendance roster (ирц), pass threshold, limited retakes,
-- and admin answer overrides with a recorded reason.

-- 1. Per-quiz rules. pass_percent NULL = ordinary daily quiz (no pass/fail).
alter table public.daily_quizzes add column if not exists pass_percent smallint
  check (pass_percent is null or pass_percent between 1 and 100);
alter table public.daily_quizzes add column if not exists max_attempts smallint not null default 1
  check (max_attempts between 1 and 10);

-- 2. Attendance roster. A quiz with at least one roster row is restricted to
--    those drivers. attempts_bonus is how many extra attempts the admin has
--    granted (e.g. after the driver re-attended the training).
create table if not exists public.quiz_attendees (
  quiz_id        uuid not null references public.daily_quizzes(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  attempts_bonus smallint not null default 0,
  added_at       timestamptz not null default now(),
  primary key (quiz_id, user_id)
);
create index if not exists idx_quiz_attendees_user on public.quiz_attendees(user_id);
alter table public.quiz_attendees enable row level security;

-- 3. Several attempts per driver per quiz.
alter table public.quiz_attempts add column if not exists attempt_number smallint not null default 1;
alter table public.quiz_attempts add column if not exists passed boolean;
alter table public.quiz_attempts add column if not exists credited_points integer not null default 0;
alter table public.quiz_attempts drop constraint if exists quiz_attempts_quiz_id_user_id_key;
alter table public.quiz_attempts drop constraint if exists quiz_attempts_quiz_user_attempt_key;
alter table public.quiz_attempts add constraint quiz_attempts_quiz_user_attempt_key
  unique (quiz_id, user_id, attempt_number);

-- Points already added to users.total_score for attempts finished before this migration.
update public.quiz_attempts set credited_points = score where completed and credited_points = 0;

-- 4. Admin answer overrides (the original is_correct stays untouched).
alter table public.quiz_answers add column if not exists override_correct boolean;
alter table public.quiz_answers add column if not exists override_reason text;
alter table public.quiz_answers add column if not exists overridden_by uuid references public.users(id);
alter table public.quiz_answers add column if not exists overridden_at timestamptz;
