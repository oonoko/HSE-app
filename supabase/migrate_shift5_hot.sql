-- Adds shift 5 ("Хот") alongside the original 4 numbered shifts.
alter table public.users drop constraint if exists users_shift_number_check;
alter table public.users add constraint users_shift_number_check
  check (shift_number is null or shift_number between 1 and 5);

-- daily_quizzes.target_shift was declared inline, so drop whatever Postgres
-- auto-named its check constraint rather than guessing the name.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where rel.relname = 'daily_quizzes' and att.attname = 'target_shift' and con.contype = 'c'
  loop
    execute format('alter table public.daily_quizzes drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.daily_quizzes add constraint daily_quizzes_target_shift_check
  check (target_shift is null or target_shift between 1 and 5);
