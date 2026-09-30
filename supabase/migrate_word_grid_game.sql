-- Replaces the 'puzzle' (image jigsaw) game template with 'word_grid'
-- (auto-generated crossword: admin supplies words + clues, the app
-- lays them out and intersects them client-side).
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where rel.relname = 'safety_games' and att.attname = 'template' and con.contype = 'c'
  loop
    execute format('alter table public.safety_games drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.safety_games add constraint safety_games_template_check
  check (template in ('truth_false', 'match', 'word_grid', 'random_box'));

-- No 'puzzle' rows exist in production at the time of writing; if any do,
-- they'll fail the check above and need to be updated or removed by hand.
