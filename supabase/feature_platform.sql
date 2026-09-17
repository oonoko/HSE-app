-- Driver shifts and super-admin permission.
alter table public.users add column if not exists shift_number smallint;
alter table public.users add column if not exists is_super_admin boolean not null default false;
alter table public.users drop constraint if exists users_shift_number_check;
alter table public.users add constraint users_shift_number_check
  check (shift_number is null or shift_number between 1 and 4);
update public.users set is_super_admin = (sap_id = '1113196');

-- Daily knowledge checks. Questions are authored and versioned with the quiz.
create table if not exists public.daily_quizzes (
  id                 uuid primary key default uuid_generate_v4(),
  title              text not null,
  topic              text,
  active_date        date not null,
  start_time         time not null default '00:00',
  end_time           time not null default '23:59',
  time_limit_seconds integer not null default 60 check (time_limit_seconds between 10 and 60),
  target_shift       smallint check (target_shift is null or target_shift between 1 and 4),
  status             text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'closed')),
  questions          jsonb not null default '[]',
  created_by         uuid not null references public.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id                 uuid primary key default uuid_generate_v4(),
  quiz_id            uuid not null references public.daily_quizzes(id) on delete cascade,
  user_id            uuid not null references public.users(id) on delete cascade,
  score              integer not null default 0,
  max_score          integer not null default 0,
  correct_count      integer not null default 0,
  wrong_count        integer not null default 0,
  total_time_seconds integer not null default 0,
  completed          boolean not null default false,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  unique(quiz_id, user_id)
);

create table if not exists public.quiz_answers (
  id             uuid primary key default uuid_generate_v4(),
  attempt_id     uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id   text not null,
  selected_index integer,
  is_correct     boolean not null,
  response_ms    integer not null,
  points         integer not null default 0,
  answered_at    timestamptz not null default now(),
  unique(attempt_id, question_id)
);

-- Re-playable knowledge games. The template-specific payload lives in content.
create table if not exists public.safety_games (
  id         uuid primary key default uuid_generate_v4(),
  title      text not null,
  category   text not null check (category in ('critical_risk_22', 'life_rules_7', 'other')),
  template   text not null check (template in ('truth_false', 'match', 'puzzle', 'random_box')),
  content    jsonb not null default '{}',
  active     boolean not null default true,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_attempts (
  id               uuid primary key default uuid_generate_v4(),
  game_id          uuid not null references public.safety_games(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  score            integer not null default 0,
  duration_seconds integer not null default 0,
  played_at        timestamptz not null default now()
);

create index if not exists idx_daily_quizzes_date_shift on public.daily_quizzes(active_date, target_shift);
create index if not exists idx_quiz_attempts_user_time on public.quiz_attempts(user_id, completed_at);
create index if not exists idx_quiz_attempts_quiz on public.quiz_attempts(quiz_id);
create index if not exists idx_quiz_answers_attempt on public.quiz_answers(attempt_id);
create index if not exists idx_game_attempts_user_time on public.game_attempts(user_id, played_at);
create index if not exists idx_game_attempts_game on public.game_attempts(game_id);

create table if not exists public.push_subscriptions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.daily_quizzes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.safety_games enable row level security;
alter table public.game_attempts enable row level security;
alter table public.push_subscriptions enable row level security;
