-- Question bank: reusable multiple-choice questions grouped by topic.
-- Quizzes copy a question's text at the time it is added, so editing the bank
-- never changes a quiz that is already running.
create table if not exists public.question_bank (
  id            uuid primary key default gen_random_uuid(),
  topic         text not null check (char_length(topic) between 1 and 80),
  text          text not null check (char_length(text) > 0),
  options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 3),
  correct_index smallint not null check (correct_index between 0 and 2),
  explanation   text,
  image_url     text,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_question_bank_topic on public.question_bank(topic);

alter table public.question_bank enable row level security;
