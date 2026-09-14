-- Migrate the existing project from prototype roles to driver/admin roles.
alter table public.users drop constraint if exists users_role_check;
alter table public.users alter column role set default 'driver';
update public.users set role = 'driver' where role in ('worker', 'manager');
alter table public.users
  add constraint users_role_check check (role in ('driver', 'admin'));

-- Remove only the six placeholder prototype accounts.
delete from public.users
where sap_id in ('10001', '10002', '10003', '10004', '10005', '99999');
