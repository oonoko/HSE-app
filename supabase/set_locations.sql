-- Only the two active operating branches should appear in the application.
update public.locations set active = false;

insert into public.locations (name, name_en, qr_code, aimag, active) values
  ('УБ салбар', 'UB Branch', 'HK-LOC-005', 'Улаанбаатар', true),
  ('Оюу Толгойн салбар', 'Oyu Tolgoi Branch', 'HK-LOC-OT', 'Өмнөговь', true)
on conflict (qr_code) do update set
  name = excluded.name,
  name_en = excluded.name_en,
  aimag = excluded.aimag,
  active = true;
